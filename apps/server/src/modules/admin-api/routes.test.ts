import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";

import type { AppConfig } from "@dm-bot/shared";

import { registerAdminApiRoutes } from "./routes.js";

function buildTestApp(overrides?: Partial<NonNullable<Parameters<typeof registerAdminApiRoutes>[1]>>) {
  const app = Fastify();
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];

  const config: AppConfig = {
    nodeEnv: "test",
    appEnv: "local",
    port: 3000,
    appBaseUrl: "http://localhost:3000",
    adminBaseUrl: "http://localhost:8080",
    databaseUrl: "postgres://test:test@localhost:5432/test",
    telegramBotToken: "test-token",
    telegramWebhookSecret: "secret",
    telegramWebhookUrl: "http://localhost/telegram/webhook",
    sessionSecret: "session-secret",
    cookieSecure: false,
    logLevel: "error",
    defaultRulesVersion: "arena-v1-alpha",
    disableNewDisputes: false,
    telegramDeliveryMode: "polling",
    telegramPollingTimeoutSeconds: 30,
  };

  app.decorate("config", config);
  app.decorate("telegram", {
    sendMessage: async (chatId: string | number, message: { text: string }) => {
      sentMessages.push({ chatId, text: message.text });
      return { ok: true };
    },
  } as any);
  app.decorate("services", {
    pingDatabase: async () => true,
  } as any);

  const adminUser = {
    id: "admin-1",
    email: "admin@example.com",
    display_name: "Admin",
    role: "super_admin" as const,
  };

  const deps: NonNullable<Parameters<typeof registerAdminApiRoutes>[1]> = {
    getAdminAuthContext: async () => null,
    loginAdmin: async () => ({
      authenticated: true,
      adminUser: {
        id: adminUser.id,
        email: adminUser.email,
        displayName: adminUser.display_name,
        role: adminUser.role,
      },
    }),
    logoutAdmin: async () => ({ authenticated: false }),
    requireAdminAuth: async () => ({ adminUser, sessionId: "session-1" }),
    requireAdminRole: (role, allowedRoles) => allowedRoles.includes(role),
    getDashboardCounts: async () => ({ pendingDisputes: 0, runningMatches: 0, failedMatches: 0 }),
    listMatches: async () => [],
    listDisputes: async () => [],
    getDisputeById: async () => null,
    cancelPendingDisputeByAdmin: async () => null,
    listUsers: async () => [],
    listCharacters: async () => [],
    listAuditLogs: async () => [],
    setUserStatus: async () => null,
    setCharacterStatus: async () => null,
    createAuditLog: async () => undefined,
    listMatchParticipants: async () => [],
    cancelMatchByAdmin: async () => null,
    finalizeMatchByAdmin: async () => null,
    getUserById: async () => null,
    getMatchById: async () => null,
    listMatchEvents: async () => [],
    ...overrides,
  };

  registerAdminApiRoutes(app, deps);

  return { app, sentMessages };
}

test("GET /api/session returns 401 when not authenticated", async () => {
  const { app } = buildTestApp({
    getAdminAuthContext: async () => null,
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/session",
  });

  assert.equal(response.statusCode, 401);
  assert.deepEqual(response.json(), {
    authenticated: false,
  });
});

test("POST /api/disputes/:id/cancel rejects moderator role", async () => {
  const { app } = buildTestApp({
    requireAdminAuth: async () => ({
      sessionId: "session-1",
      adminUser: {
        id: "admin-2",
        email: "mod@example.com",
        display_name: "Mod",
        role: "moderator",
      },
    }),
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/disputes/dispute-1/cancel",
    payload: {
      reason: "Recovery cleanup",
    },
  });

  assert.equal(response.statusCode, 403);
  assert.match(response.body, /cannot cancel disputes/);
});

test("POST /api/disputes/:id/cancel cancels pending dispute, audits, and notifies users", async () => {
  const auditCalls: unknown[] = [];
  const { app, sentMessages } = buildTestApp({
    getDisputeById: async () => ({
      id: "dispute-1",
      challenger_user_id: "user-1",
      target_user_id: "user-2",
      challenger_character_id: "char-1",
      target_character_id: "char-2",
      reason: "boofery",
      status: "pending",
      created_at: new Date(),
    }),
    cancelPendingDisputeByAdmin: async () => ({
      id: "dispute-1",
      challenger_user_id: "user-1",
      target_user_id: "user-2",
      challenger_character_id: "char-1",
      target_character_id: "char-2",
      reason: "boofery",
      status: "cancelled",
      created_at: new Date(),
    }),
    getUserById: async (id: string) => ({
      id,
      telegram_user_id: `${id}-tg`,
      telegram_username: null,
      telegram_first_name: null,
      telegram_last_name: null,
      display_name: id,
      status: "active",
    }),
    createAuditLog: async (params) => {
      auditCalls.push(params);
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/disputes/dispute-1/cancel",
    payload: {
      reason: "Manual recovery cleanup",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sentMessages.length, 2);
  assert.equal(auditCalls.length, 1);
  assert.match(sentMessages[0]!.text, /Manual recovery cleanup/);
});

test("POST /api/matches/:id/finalize finalizes flagged match, audits, and notifies users", async () => {
  const auditCalls: unknown[] = [];
  const { app, sentMessages } = buildTestApp({
    listMatchParticipants: async () => [
      {
        id: "participant-1",
        match_id: "match-1",
        character_id: "char-1",
        user_id: "user-1",
        slot: 1,
        is_winner: false,
        character_name: "Rheen",
        user_display_name: "User One",
        snapshot: {},
        created_at: new Date(),
      },
      {
        id: "participant-2",
        match_id: "match-1",
        character_id: "char-2",
        user_id: "user-2",
        slot: 2,
        is_winner: false,
        character_name: "Ignus",
        user_display_name: "User Two",
        snapshot: {},
        created_at: new Date(),
      },
    ],
    finalizeMatchByAdmin: async () => ({
      id: "match-1",
      dispute_id: "dispute-1",
      status: "finalized_by_admin",
      winner_character_id: "char-1",
      end_reason: "admin_finalized",
      rounds_completed: 4,
      created_at: new Date(),
      completed_at: new Date(),
      error_summary: null,
      admin_finalization_reason: "Logs were truncated during deploy",
    }),
    getUserById: async (id: string) => ({
      id,
      telegram_user_id: `${id}-tg`,
      telegram_username: null,
      telegram_first_name: null,
      telegram_last_name: null,
      display_name: id,
      status: "active",
    }),
    createAuditLog: async (params) => {
      auditCalls.push(params);
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/matches/match-1/finalize",
    payload: {
      winnerCharacterId: "char-1",
      reason: "Logs were truncated during deploy",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(sentMessages.length, 2);
  assert.equal(auditCalls.length, 1);
  assert.match(sentMessages[0]!.text, /Winner: Rheen/);
});

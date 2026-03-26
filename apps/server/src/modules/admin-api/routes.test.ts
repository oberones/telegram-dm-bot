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
    listPartySummaries: async () => [],
    listPartyMemberDetails: async () => [],
    listActiveAdventureRuns: async () => [],
    getAdventureRunById: async () => null,
    getEncounterById: async () => null,
    getPartyById: async () => null,
    getRunRoomDetailById: async () => null,
    listEncountersForRun: async () => [],
    listRunRewardsForRun: async () => [],
    getDisputeById: async () => null,
    cancelPendingDisputeByAdmin: async () => null,
    listUsers: async () => [],
    listCharacters: async () => [],
    listAuditLogs: async () => [],
    setUserStatus: async () => null,
    setCharacterStatus: async () => null,
    createAuditLog: async () => undefined,
    updateAdventureRun: async () => null,
    updateEncounter: async () => null,
    updateParty: async () => null,
    updateRunRoom: async () => null,
    getCharacterById: async () => null,
    listInventoryItemsForCharacter: async () => [],
    listEquipmentLoadoutsForCharacter: async () => [],
    listLootTemplates: async () => [],
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

test("POST /api/logout clears the admin session cookie", async () => {
  const app = Fastify();
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
    sendMessage: async () => ({ ok: true }),
  } as any);
  app.decorate("services", {
    pingDatabase: async () => true,
  } as any);

  registerAdminApiRoutes(app);

  const response = await app.inject({
    method: "POST",
    url: "/api/logout",
  });
  const setCookie = Array.isArray(response.headers["set-cookie"])
    ? response.headers["set-cookie"].join("; ")
    : (response.headers["set-cookie"] ?? "");

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { authenticated: false });
  assert.match(setCookie, /dm_admin_session=/);
  assert.match(setCookie, /SameSite=Strict/);
  assert.match(setCookie, /Max-Age=0/);
});

test("POST /api/login returns 400 when email or password is missing", async () => {
  const { app } = buildTestApp();

  const response = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: {
      email: "admin@example.com",
    },
  });

  assert.equal(response.statusCode, 400);
  assert.deepEqual(response.json(), {
    error: "Email and password are required",
  });
});

test("POST /api/login delegates to loginAdmin for valid credentials", async () => {
  let receivedEmail = "";
  let receivedPassword = "";
  const { app } = buildTestApp({
    loginAdmin: async (_app, _request, _reply, email, password) => {
      receivedEmail = email;
      receivedPassword = password;
      return {
        authenticated: true,
        adminUser: {
          id: "admin-1",
          email,
          displayName: "Admin",
          role: "super_admin",
        },
      };
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/api/login",
    payload: {
      email: "admin@example.com",
      password: "correct horse battery staple",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(receivedEmail, "admin@example.com");
  assert.equal(receivedPassword, "correct horse battery staple");
  assert.deepEqual(response.json(), {
    authenticated: true,
    adminUser: {
      id: "admin-1",
      email: "admin@example.com",
      displayName: "Admin",
      role: "super_admin",
    },
  });
});

test("GET /api/parties returns active parties with members for authenticated admins", async () => {
  const { app } = buildTestApp({
    listPartySummaries: async () => [{
      id: "party-1",
      leader_user_id: "user-1",
      leader_display_name: "Bilbo",
      status: "forming",
      active_run_id: null,
      party_name: "Bilbo's party",
      created_at: new Date(),
      updated_at: new Date(),
    }],
    listPartyMemberDetails: async () => [{
      id: "member-1",
      party_id: "party-1",
      user_id: "user-1",
      character_id: "char-1",
      status: "joined",
      joined_at: new Date(),
      ready_at: null,
      left_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      user_display_name: "Bilbo",
      telegram_username: "bilbo",
      character_name: "Rheen",
      class_key: "fighter",
    }],
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/parties",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().parties[0].id, "party-1");
  assert.equal(response.json().parties[0].members[0].character_name, "Rheen");
});

test("GET /api/runs/:id/rewards returns reward ledger rows for authenticated admins", async () => {
  const { app } = buildTestApp({
    listRunRewardsForRun: async () => [{
      id: "reward-1",
      run_id: "run-1",
      room_id: "room-1",
      encounter_id: "encounter-1",
      recipient_user_id: "user-1",
      recipient_character_id: "char-1",
      loot_template_id: "loot-1",
      reward_kind: "weapon",
      status: "granted",
      quantity: 1,
      reward_payload: {
        itemName: "Balanced Longsword",
      },
      granted_at: new Date(),
      revoked_at: null,
      created_at: new Date(),
    }],
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/runs/run-1/rewards",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().rewards[0].reward_kind, "weapon");
});

test("GET /api/runs/:id/recovery returns crawler recovery detail for authenticated admins", async () => {
  const { app } = buildTestApp({
    getAdventureRunById: async () => ({
      id: "run-1",
      party_id: "party-1",
      status: "paused",
      seed: "seed-1",
      generation_version: "crawler-v1",
      theme_key: "crypt",
      rules_version_id: "rules-1",
      floor_count: 3,
      current_floor_number: 1,
      current_room_id: "room-1",
      active_encounter_id: null,
      difficulty_tier: 1,
      summary: {},
      started_at: new Date(),
      completed_at: null,
      failed_at: null,
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    getRunRoomDetailById: async () => ({
      id: "room-1",
      run_id: "run-1",
      floor_id: "floor-1",
      floor_number: 1,
      room_number: 2,
      room_type: "combat",
      status: "active",
      template_key: "combat:test",
      prompt_payload: {},
      generation_payload: {},
      entered_at: new Date(),
      resolved_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    listEncountersForRun: async () => [{
      id: "enc-1",
      run_id: "run-1",
      room_id: "room-1",
      status: "error",
      encounter_key: "combat:test",
      encounter_snapshot: {},
      started_at: new Date(),
      completed_at: null,
      errored_at: new Date(),
      error_summary: "Combat lock detected",
      created_at: new Date(),
      updated_at: new Date(),
    }],
    listRunRewardsForRun: async () => [{
      id: "reward-1",
      run_id: "run-1",
      room_id: "room-1",
      encounter_id: "enc-1",
      recipient_user_id: "user-1",
      recipient_character_id: "char-1",
      loot_template_id: "loot-1",
      reward_kind: "weapon",
      status: "pending",
      quantity: 1,
      reward_payload: {
        itemName: "Balanced Longsword",
      },
      granted_at: null,
      revoked_at: null,
      created_at: new Date(),
    }],
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/runs/run-1/recovery",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().encounters[0].id, "enc-1");
  assert.equal(response.json().reward_summary.pending, 1);
  assert.match(response.json().encounters[0].recovery_hint, /Combat lock detected/);
});

test("GET /api/runs includes crawler recovery hints for authenticated admins", async () => {
  const { app } = buildTestApp({
    listActiveAdventureRuns: async () => [{
      id: "run-1",
      party_id: "party-1",
      status: "awaiting_choice",
      seed: "seed-1",
      generation_version: "crawler-v1",
      theme_key: "crypt",
      rules_version_id: "rules-1",
      floor_count: 3,
      current_floor_number: 1,
      current_room_id: "room-1",
      active_encounter_id: null,
      difficulty_tier: 1,
      summary: {},
      started_at: new Date(),
      completed_at: null,
      failed_at: null,
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    }],
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/runs",
  });

  assert.equal(response.statusCode, 200);
  assert.match(response.json().runs[0].recovery_hint, /waiting on room input/i);
});

test("GET /api/characters/:id/crawler-loadout returns inventory and equipped items", async () => {
  const { app } = buildTestApp({
    getCharacterById: async () => ({
      id: "char-1",
      user_id: "user-1",
      name: "Rheen",
      class_key: "fighter",
      level: 1,
      crawler_level: 1,
      crawler_xp: 0,
      rules_version_id: "rules-1",
      status: "active",
      ability_scores: {},
      derived_stats: {},
      loadout: {},
      resource_state: {},
      crawler_stats: {},
      wins: 0,
      losses: 0,
      matches_played: 0,
      last_match_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    listInventoryItemsForCharacter: async () => [{
      id: "item-1",
      user_id: "user-1",
      character_id: "char-1",
      loot_template_id: "loot-1",
      status: "equipped",
      quantity: 1,
      metadata: {},
      acquired_at: new Date(),
      consumed_at: null,
      lost_at: null,
    }],
    listEquipmentLoadoutsForCharacter: async () => [{
      id: "loadout-1",
      character_id: "char-1",
      slot: "weapon",
      inventory_item_id: "item-1",
      equipped_at: new Date(),
      created_at: new Date(),
      item_status: "equipped",
      loot_template_id: "loot-1",
      loot_template_key: "balanced_longsword",
      loot_display_name: "Balanced Longsword",
      category_key: "weapon",
      rarity_key: "common",
      effect_data: { attackBonus: 1 },
    }],
    listLootTemplates: async () => [{
      id: "loot-1",
      template_key: "balanced_longsword",
      display_name: "Balanced Longsword",
      category_key: "weapon",
      rarity_key: "common",
      equipment_slot: "weapon",
      is_permanent: true,
      effect_data: { attackBonus: 1 },
      drop_rules: {},
      is_active: true,
      content_version: "crawler-v1",
    }],
  });

  const response = await app.inject({
    method: "GET",
    url: "/api/characters/char-1/crawler-loadout",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().character.id, "char-1");
  assert.equal(response.json().inventory[0].lootTemplate.display_name, "Balanced Longsword");
  assert.equal(response.json().loadouts[0].slot, "weapon");
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

test("POST /api/runs/:id/fail fails stuck crawler runs, audits, and notifies party members", async () => {
  const auditCalls: unknown[] = [];
  const cancelledEncounters: string[] = [];
  const { app, sentMessages } = buildTestApp({
    getAdventureRunById: async () => ({
      id: "run-1",
      party_id: "party-1",
      status: "awaiting_choice",
      seed: "seed-1",
      generation_version: "crawler-v1",
      theme_key: "crypt",
      rules_version_id: "rules-1",
      floor_count: 3,
      current_floor_number: 1,
      current_room_id: "room-1",
      active_encounter_id: null,
      difficulty_tier: 1,
      summary: {},
      started_at: new Date(),
      completed_at: null,
      failed_at: null,
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    getPartyById: async () => ({
      id: "party-1",
      leader_user_id: "user-1",
      status: "in_run",
      active_run_id: "run-1",
      party_name: "Crawler Party",
      created_at: new Date(),
      updated_at: new Date(),
    }),
    listPartyMemberDetails: async () => [
      {
        id: "member-1",
        party_id: "party-1",
        user_id: "user-1",
        character_id: "char-1",
        status: "ready",
        joined_at: new Date(),
        ready_at: new Date(),
        left_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        user_display_name: "Bilbo",
        telegram_username: "bilbo",
        character_name: "Rheen",
        class_key: "fighter",
      },
      {
        id: "member-2",
        party_id: "party-1",
        user_id: "user-2",
        character_id: "char-2",
        status: "ready",
        joined_at: new Date(),
        ready_at: new Date(),
        left_at: null,
        created_at: new Date(),
        updated_at: new Date(),
        user_display_name: "Frodo",
        telegram_username: "frodo",
        character_name: "Ignus",
        class_key: "wizard",
      },
    ],
    getRunRoomDetailById: async () => ({
      id: "room-1",
      run_id: "run-1",
      floor_id: "floor-1",
      floor_number: 1,
      room_number: 2,
      room_type: "combat",
      status: "active",
      template_key: "combat:test",
      prompt_payload: {},
      generation_payload: {},
      entered_at: new Date(),
      resolved_at: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    listEncountersForRun: async () => [
      {
        id: "encounter-1",
        run_id: "run-1",
        room_id: "room-1",
        status: "active",
        encounter_key: "combat:test",
        encounter_snapshot: {},
        started_at: new Date(),
        completed_at: null,
        errored_at: null,
        error_summary: null,
        created_at: new Date(),
        updated_at: new Date(),
      },
    ],
    updateEncounter: async ({ encounterId }) => {
      cancelledEncounters.push(encounterId);
      return null;
    },
    updateRunRoom: async () => null,
    updateAdventureRun: async () => ({
      id: "run-1",
      party_id: "party-1",
      status: "failed",
      seed: "seed-1",
      generation_version: "crawler-v1",
      theme_key: "crypt",
      rules_version_id: "rules-1",
      floor_count: 3,
      current_floor_number: 1,
      current_room_id: "room-1",
      active_encounter_id: null,
      difficulty_tier: 1,
      summary: {
        adminRecovery: {
          action: "run_failed_by_admin",
        },
      },
      started_at: new Date(),
      completed_at: null,
      failed_at: new Date(),
      failure_reason: "Room callback chain stalled after deploy",
      created_at: new Date(),
      updated_at: new Date(),
    }),
    updateParty: async () => null,
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
    url: "/api/runs/run-1/fail",
    payload: {
      reason: "Room callback chain stalled after deploy",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().run.status, "failed");
  assert.deepEqual(cancelledEncounters, ["encounter-1"]);
  assert.equal(auditCalls.length, 1);
  assert.equal(sentMessages.length, 2);
  assert.match(sentMessages[0]!.text, /closed a crawler run/);
});

test("POST /api/encounters/:id/error marks a stuck crawler encounter errored, pauses the run, audits, and notifies party members", async () => {
  const auditCalls: unknown[] = [];
  const { app, sentMessages } = buildTestApp({
    getEncounterById: async () => ({
      id: "encounter-1",
      run_id: "run-1",
      room_id: "room-1",
      status: "active",
      encounter_key: "combat:test",
      encounter_snapshot: {},
      started_at: new Date(),
      completed_at: null,
      errored_at: null,
      error_summary: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    getAdventureRunById: async () => ({
      id: "run-1",
      party_id: "party-1",
      status: "in_combat",
      seed: "seed-1",
      generation_version: "crawler-v1",
      theme_key: "crypt",
      rules_version_id: "rules-1",
      floor_count: 3,
      current_floor_number: 1,
      current_room_id: "room-1",
      active_encounter_id: "encounter-1",
      difficulty_tier: 1,
      summary: {},
      started_at: new Date(),
      completed_at: null,
      failed_at: null,
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
    }),
    getPartyById: async () => ({
      id: "party-1",
      leader_user_id: "user-1",
      status: "in_run",
      active_run_id: "run-1",
      party_name: "Crawler Party",
      created_at: new Date(),
      updated_at: new Date(),
    }),
    listPartyMemberDetails: async () => [{
      id: "member-1",
      party_id: "party-1",
      user_id: "user-1",
      character_id: "char-1",
      status: "ready",
      joined_at: new Date(),
      ready_at: new Date(),
      left_at: null,
      created_at: new Date(),
      updated_at: new Date(),
      user_display_name: "Bilbo",
      telegram_username: "bilbo",
      character_name: "Rheen",
      class_key: "fighter",
    }],
    updateEncounter: async () => ({
      id: "encounter-1",
      run_id: "run-1",
      room_id: "room-1",
      status: "error",
      encounter_key: "combat:test",
      encounter_snapshot: {},
      started_at: new Date(),
      completed_at: null,
      errored_at: new Date(),
      error_summary: "Combat lock detected",
      created_at: new Date(),
      updated_at: new Date(),
    }),
    updateAdventureRun: async () => ({
      id: "run-1",
      party_id: "party-1",
      status: "paused",
      seed: "seed-1",
      generation_version: "crawler-v1",
      theme_key: "crypt",
      rules_version_id: "rules-1",
      floor_count: 3,
      current_floor_number: 1,
      current_room_id: "room-1",
      active_encounter_id: null,
      difficulty_tier: 1,
      summary: {
        adminRecovery: {
          action: "encounter_marked_error_by_admin",
        },
      },
      started_at: new Date(),
      completed_at: null,
      failed_at: null,
      failure_reason: null,
      created_at: new Date(),
      updated_at: new Date(),
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
    url: "/api/encounters/encounter-1/error",
    payload: {
      reason: "Combat lock detected",
    },
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().encounter.status, "error");
  assert.equal(response.json().run.status, "paused");
  assert.equal(auditCalls.length, 1);
  assert.equal(sentMessages.length, 1);
  assert.match(sentMessages[0]!.text, /paused a crawler run for recovery review/);
});

import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import type { AppConfig } from "@dm-bot/shared";

import { registerTelegramRoutes } from "./routes.js";

function buildConfig(): AppConfig {
  return {
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
}

test("POST /telegram/webhook rejects invalid secret", async () => {
  const app = Fastify();
  app.decorate("config", buildConfig());
  app.decorate("telegram", {} as any);
  app.decorate("services", {
    pingDatabase: async () => true,
  } as any);

  const calls: unknown[] = [];

  registerTelegramRoutes(app, {
    processTelegramUpdate: async (...args) => {
      calls.push(args);
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/telegram/webhook",
    payload: {
      update_id: 1,
    },
  });

  assert.equal(response.statusCode, 401);
  assert.equal(calls.length, 0);
});

test("POST /telegram/webhook accepts valid secret and processes update", async () => {
  const app = Fastify();
  app.decorate("config", buildConfig());
  app.decorate("telegram", {} as any);
  app.decorate("services", {
    pingDatabase: async () => true,
  } as any);

  const calls: unknown[] = [];

  registerTelegramRoutes(app, {
    processTelegramUpdate: async (_app, update) => {
      calls.push(update);
    },
  });

  const response = await app.inject({
    method: "POST",
    url: "/telegram/webhook",
    headers: {
      "x-telegram-bot-api-secret-token": "secret",
    },
    payload: {
      update_id: 1,
      message: {
        message_id: 1,
        date: 1,
        text: "/start",
        chat: { id: 123, type: "private" },
        from: { id: 456, first_name: "Test" },
      },
    },
  });

  assert.equal(response.statusCode, 200);
  assert.deepEqual(response.json(), { ok: true });
  assert.equal(calls.length, 1);
});

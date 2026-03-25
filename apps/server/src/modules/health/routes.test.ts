import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import type { AppConfig } from "@dm-bot/shared";

import { registerHealthRoutes } from "./routes.js";

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

test("GET /health returns ok", async () => {
  const app = Fastify();
  app.decorate("config", buildConfig());
  app.decorate("telegram", {} as any);
  app.decorate("services", {
    pingDatabase: async () => true,
  } as any);

  registerHealthRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/health",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().status, "ok");
});

test("GET /ready reports database error when ping fails", async () => {
  const app = Fastify();
  app.decorate("config", buildConfig());
  app.decorate("telegram", {} as any);
  app.decorate("services", {
    pingDatabase: async () => {
      throw new Error("db down");
    },
  } as any);

  registerHealthRoutes(app);

  const response = await app.inject({
    method: "GET",
    url: "/ready",
  });

  assert.equal(response.statusCode, 200);
  assert.equal(response.json().checks.database, "error");
});

import assert from "node:assert/strict";
import test from "node:test";

import { loadConfig } from "./env.js";

const originalEnv = { ...process.env };

function resetEnv(overrides: Record<string, string | undefined>) {
  process.env = { ...originalEnv };

  for (const [key, value] of Object.entries(overrides)) {
    if (value === undefined) {
      delete process.env[key];
      continue;
    }

    process.env[key] = value;
  }
}

test.afterEach(() => {
  process.env = { ...originalEnv };
});

test("loadConfig rejects placeholder production secrets", () => {
  resetEnv({
    APP_ENV: "production",
    NODE_ENV: "production",
    PORT: "3000",
    APP_BASE_URL: "https://arena.example",
    ADMIN_BASE_URL: "https://arena.example/admin",
    DATABASE_URL: "postgres://postgres:postgres@postgres:5432/dungeon_master_bot",
    TELEGRAM_BOT_TOKEN: "replace-me",
    TELEGRAM_WEBHOOK_SECRET: "replace-me",
    TELEGRAM_WEBHOOK_URL: "https://arena.example/telegram/webhook",
    SESSION_SECRET: "replace-with-a-long-random-string",
    COOKIE_SECURE: "true",
    LOG_LEVEL: "info",
    DEFAULT_RULES_VERSION: "arena-v1-alpha",
    DISABLE_NEW_DISPUTES: "false",
    TELEGRAM_DELIVERY_MODE: "webhook",
    TELEGRAM_POLLING_TIMEOUT_SECONDS: "30",
    ADMIN_BOOTSTRAP_EMAIL: "admin@example.com",
    ADMIN_BOOTSTRAP_PASSWORD: "change-me",
  });

  assert.throws(() => loadConfig(), /Unsafe production configuration/);
});

test("loadConfig rejects insecure production cookies", () => {
  resetEnv({
    APP_ENV: "production",
    NODE_ENV: "production",
    PORT: "3000",
    APP_BASE_URL: "https://arena.example",
    ADMIN_BASE_URL: "https://arena.example/admin",
    DATABASE_URL: "postgres://postgres:postgres@postgres:5432/dungeon_master_bot",
    TELEGRAM_BOT_TOKEN: "123456:realistic-production-token",
    TELEGRAM_WEBHOOK_SECRET: "super-secret-webhook-value",
    TELEGRAM_WEBHOOK_URL: "https://arena.example/telegram/webhook",
    SESSION_SECRET: "super-secret-session-value",
    COOKIE_SECURE: "false",
    LOG_LEVEL: "info",
    DEFAULT_RULES_VERSION: "arena-v1-alpha",
    DISABLE_NEW_DISPUTES: "false",
    TELEGRAM_DELIVERY_MODE: "webhook",
    TELEGRAM_POLLING_TIMEOUT_SECONDS: "30",
    ADMIN_BOOTSTRAP_EMAIL: "ops@arena.example",
    ADMIN_BOOTSTRAP_PASSWORD: "changed-production-password",
  });

  assert.throws(() => loadConfig(), /COOKIE_SECURE must be true/);
});

test("loadConfig accepts a non-placeholder production configuration", () => {
  resetEnv({
    APP_ENV: "production",
    NODE_ENV: "production",
    PORT: "3000",
    APP_BASE_URL: "https://arena.example",
    ADMIN_BASE_URL: "https://arena.example/admin",
    DATABASE_URL: "postgres://postgres:postgres@postgres:5432/dungeon_master_bot",
    TELEGRAM_BOT_TOKEN: "123456:realistic-production-token",
    TELEGRAM_WEBHOOK_SECRET: "super-secret-webhook-value",
    TELEGRAM_WEBHOOK_URL: "https://arena.example/telegram/webhook",
    SESSION_SECRET: "super-secret-session-value",
    COOKIE_SECURE: "true",
    LOG_LEVEL: "info",
    DEFAULT_RULES_VERSION: "arena-v1-alpha",
    DISABLE_NEW_DISPUTES: "false",
    TELEGRAM_DELIVERY_MODE: "webhook",
    TELEGRAM_POLLING_TIMEOUT_SECONDS: "30",
    ADMIN_BOOTSTRAP_EMAIL: "ops@arena.example",
    ADMIN_BOOTSTRAP_PASSWORD: "changed-production-password",
  });

  const config = loadConfig();

  assert.equal(config.appEnv, "production");
  assert.equal(config.cookieSecure, true);
  assert.equal(config.telegramDeliveryMode, "webhook");
});

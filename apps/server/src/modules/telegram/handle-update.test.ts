import assert from "node:assert/strict";
import test from "node:test";

import Fastify from "fastify";
import type { AppConfig } from "@dm-bot/shared";

import { processTelegramUpdate } from "./handle-update.js";

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

function buildTestApp() {
  const app = Fastify();
  const sentMessages: Array<{ chatId: string | number; text: string }> = [];
  const answeredCallbacks: Array<{ id: string; text: string | undefined }> = [];

  app.decorate("config", buildConfig());
  app.decorate("telegram", {
    sendMessage: async (chatId: string | number, message: { text: string }) => {
      sentMessages.push({ chatId, text: message.text });
      return { ok: true };
    },
    answerCallbackQuery: async (id: string, text?: string) => {
      answeredCallbacks.push({ id, text });
      return { ok: true };
    },
  } as any);
  app.decorate("services", {
    pingDatabase: async () => true,
  } as any);

  return { app, sentMessages, answeredCallbacks };
}

function buildDeps() {
  return {
    handleCallback: async () => ({ alertText: "ok", message: { text: "callback worked" } }),
    handleDecline: async () => ({ message: { text: "declined" } }),
    handleCancel: async () => ({ text: "cancelled" }),
    handleCharacter: async () => ({ text: "character sheet" }),
    handleCreateCharacter: async () => ({ text: "create flow" }),
    handleDeleteCharacterConfirm: async () => ({ text: "character deleted" }),
    handleDeleteCharacterPrompt: async () => ({ text: "delete prompt" }),
    handleDisputeCommand: async () => ({ message: { text: "dispute created" } }),
    handleHistory: async () => ({ text: "history" }),
    handleHelp: async () => ({ text: "help" }),
    handleRecord: async () => ({ text: "record" }),
    handleStart: async () => ({ text: "welcome" }),
    handleAccept: async () => ({ message: { text: "accepted" } }),
    handleParsedDisputeCommand: async () => ({ message: { text: "parsed dispute" } }),
    handleReplyDisputeCommand: async () => ({ message: { text: "reply dispute" } }),
    handleTextMessage: async () => null,
  };
}

test("processTelegramUpdate handles /start in DM", async () => {
  const { app, sentMessages } = buildTestApp();

  await processTelegramUpdate(
    app,
    {
      update_id: 1,
      message: {
        message_id: 1,
        text: "/start",
        chat: { id: 100, type: "private" },
        from: { id: 200, is_bot: false, first_name: "Bilbo" },
      },
    },
    buildDeps(),
  );

  assert.deepEqual(sentMessages, [{ chatId: 100, text: "welcome" }]);
});

test("processTelegramUpdate redirects /create_character in group chats", async () => {
  const { app, sentMessages } = buildTestApp();

  await processTelegramUpdate(
    app,
    {
      update_id: 2,
      message: {
        message_id: 1,
        text: "/create_character",
        chat: { id: -100, type: "group" },
        from: { id: 200, is_bot: false, first_name: "Bilbo" },
      },
    },
    buildDeps(),
  );

  assert.match(sentMessages[0]!.text, /Character creation works in DM right now/);
});

test("processTelegramUpdate routes reply-based disputes", async () => {
  const { app, sentMessages } = buildTestApp();
  let called = false;

  await processTelegramUpdate(
    app,
    {
      update_id: 3,
      message: {
        message_id: 1,
        text: "/dispute boofery",
        chat: { id: -100, type: "group" },
        from: { id: 200, is_bot: false, first_name: "Bilbo" },
        reply_to_message: {
          message_id: 2,
          text: "hello",
          chat: { id: -100, type: "group" },
          from: { id: 300, is_bot: false, first_name: "Frodo" },
        },
      },
    },
    {
      ...buildDeps(),
      handleReplyDisputeCommand: async () => {
        called = true;
        return { message: { text: "reply dispute" } };
      },
    },
  );

  assert.equal(called, true);
  assert.deepEqual(sentMessages, [{ chatId: -100, text: "reply dispute" }]);
});

test("processTelegramUpdate supports /delete_character in DM", async () => {
  const { app, sentMessages } = buildTestApp();

  await processTelegramUpdate(
    app,
    {
      update_id: 4,
      message: {
        message_id: 1,
        text: "/delete_character",
        chat: { id: 100, type: "private" },
        from: { id: 200, is_bot: false, first_name: "Bilbo" },
      },
    },
    buildDeps(),
  );

  assert.deepEqual(sentMessages, [{ chatId: 100, text: "delete prompt" }]);
});

test("processTelegramUpdate handles delete confirmation callback", async () => {
  const { app, sentMessages, answeredCallbacks } = buildTestApp();

  await processTelegramUpdate(
    app,
    {
      update_id: 5,
      callback_query: {
        id: "callback-1",
        data: "character:delete:confirm",
        from: { id: 200, is_bot: false, first_name: "Bilbo" },
        message: {
          message_id: 1,
          text: "Delete?",
          chat: { id: 100, type: "private" },
        },
      },
    },
    {
      ...buildDeps(),
      handleCallback: async () => ({
        alertText: "Character deleted",
        message: { text: "character deleted" },
      }),
    },
  );

  assert.deepEqual(answeredCallbacks, [{ id: "callback-1", text: "Character deleted" }]);
  assert.deepEqual(sentMessages, [{ chatId: 100, text: "character deleted" }]);
});

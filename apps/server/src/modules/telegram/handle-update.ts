import type { FastifyInstance } from "fastify";

import {
  handleCallback,
  handleCancel,
  handleCharacter,
  handleCreateCharacter,
  handleStart,
  handleTextMessage,
} from "@dm-bot/domain";

import type { TelegramUpdate } from "../../lib/telegram-types.js";

function actorFromUser(user: {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}) {
  return {
    telegramUserId: String(user.id),
    telegramUsername: user.username,
    telegramFirstName: user.first_name,
    telegramLastName: user.last_name,
  };
}

export async function processTelegramUpdate(app: FastifyInstance, update: TelegramUpdate) {
  if (update.callback_query?.from && update.callback_query.message?.chat.id) {
    const result = await handleCallback(
      actorFromUser(update.callback_query.from),
      update.callback_query.data ?? "",
    );

    if (result.alertText) {
      await app.telegram.answerCallbackQuery(update.callback_query.id, result.alertText);
    }

    if (result.message) {
      await app.telegram.sendMessage(update.callback_query.message.chat.id, result.message);
    }

    return;
  }

  if (!update.message?.from || !update.message.text) {
    return;
  }

  const actor = actorFromUser(update.message.from);
  const chatId = update.message.chat.id;
  const text = update.message.text.trim();

  if (text === "/start") {
    await app.telegram.sendMessage(chatId, await handleStart(actor));
    return;
  }

  if (text === "/create_character") {
    await app.telegram.sendMessage(chatId, await handleCreateCharacter(actor));
    return;
  }

  if (text === "/character") {
    await app.telegram.sendMessage(chatId, await handleCharacter(actor));
    return;
  }

  if (text === "/cancel") {
    await app.telegram.sendMessage(chatId, await handleCancel(actor));
    return;
  }

  const sessionMessage = await handleTextMessage(actor, text);

  if (sessionMessage) {
    await app.telegram.sendMessage(chatId, sessionMessage);
  }
}

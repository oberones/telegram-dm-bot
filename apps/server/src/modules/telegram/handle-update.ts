import type { FastifyInstance } from "fastify";

import {
  handleCallback,
  handleDecline,
  handleCancel,
  handleCharacter,
  handleCreateCharacter,
  handleDisputeCommand,
  handleHelp,
  handleStart,
  handleAccept,
  handleParsedDisputeCommand,
  handleReplyDisputeCommand,
  handleTextMessage,
  type NotificationMessage,
} from "@dm-bot/domain";

import type { TelegramMessage, TelegramUpdate } from "../../lib/telegram-types.js";

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

    await sendNotifications(app, result.notifications ?? []);

    return;
  }

  if (!update.message?.from || !update.message.text) {
    return;
  }

  const actor = actorFromUser(update.message.from);
  const chatId = update.message.chat.id;
  const text = update.message.text.trim();
  const chatType = update.message.chat.type;
  const normalizedCommand = normalizeCommand(text);
  const isPrivateChat = chatType === "private";

  if (normalizedCommand === "/start") {
    await app.telegram.sendMessage(chatId, await handleStart(actor));
    return;
  }

  if (normalizedCommand === "/help") {
    await app.telegram.sendMessage(chatId, await handleHelp());
    return;
  }

  if (normalizedCommand === "/create_character") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Character creation works in DM right now. Open a private chat with the bot and send /create_character there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await handleCreateCharacter(actor));
    return;
  }

  if (normalizedCommand === "/character") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Character sheets are shown in DM right now. Open a private chat with the bot and send /character there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await handleCharacter(actor));
    return;
  }

  if (normalizedCommand === "/cancel") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Use /cancel in DM to clear a private bot flow.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await handleCancel(actor));
    return;
  }

  if (normalizedCommand === "/dispute") {
    const result = await resolveDisputeCommand(actor, update.message, text);
    await app.telegram.sendMessage(chatId, result.message);
    await sendNotifications(app, result.notifications ?? []);
    return;
  }

  if (normalizedCommand === "/accept") {
    const result = await handleAccept(actor);
    await app.telegram.sendMessage(chatId, result.message);
    await sendNotifications(app, result.notifications ?? []);
    return;
  }

  if (normalizedCommand === "/decline") {
    const result = await handleDecline(actor);
    await app.telegram.sendMessage(chatId, result.message);
    await sendNotifications(app, result.notifications ?? []);
    return;
  }

  if (!isPrivateChat) {
    return;
  }

  const sessionMessage = await handleTextMessage(actor, text);

  if (sessionMessage) {
    await app.telegram.sendMessage(chatId, sessionMessage);
  }
}

async function sendNotifications(app: FastifyInstance, notifications: NotificationMessage[]) {
  for (const notification of notifications) {
    await app.telegram.sendMessage(notification.telegramUserId, notification.message);
  }
}

function normalizeCommand(text: string) {
  if (!text.startsWith("/")) {
    return null;
  }

  const firstToken = text.split(/\s+/, 1)[0] ?? "";
  return firstToken.replace(/@[^@\s]+$/, "");
}

async function resolveDisputeCommand(
  actor: ReturnType<typeof actorFromUser>,
  message: TelegramMessage,
  text: string,
) {
  const repliedUserId = message.reply_to_message?.from?.id;

  if (repliedUserId && !message.reply_to_message?.from?.is_bot) {
    return handleReplyDisputeCommand({
      actor,
      text,
      repliedUserTelegramId: String(repliedUserId),
    });
  }

  const entityTarget = extractMentionTarget(message);

  if (entityTarget) {
    const reason = removeTargetFromDisputeText(text, entityTarget.rawText);

    return handleDisputeCommand({
      actor,
      reason,
      target: entityTarget.target,
    });
  }

  return handleParsedDisputeCommand(actor, text);
}

function extractMentionTarget(message: TelegramMessage):
  | {
      rawText: string;
      target:
        | { type: "username"; username: string }
        | { type: "telegram_user_id"; telegramUserId: string };
    }
  | undefined {
  const text = message.text ?? "";

  for (const entity of message.entities ?? []) {
    if (entity.type !== "mention" && entity.type !== "text_mention") {
      continue;
    }

    const rawText = text.slice(entity.offset, entity.offset + entity.length);

    if (entity.type === "mention") {
      return {
        rawText,
        target: {
          type: "username",
          username: rawText,
        },
      };
    }

    if (entity.type === "text_mention" && entity.user) {
      return {
        rawText,
        target: {
          type: "telegram_user_id",
          telegramUserId: String(entity.user.id),
        },
      };
    }
  }

  return undefined;
}

function removeTargetFromDisputeText(text: string, rawTargetText: string) {
  const withoutCommand = text.replace(/^\/dispute(?:@[A-Za-z0-9_]+)?\s+/, "");
  const withoutTarget = withoutCommand.replace(rawTargetText, "").trim();
  return withoutTarget;
}

import type { FastifyInstance } from "fastify";

import {
  handleCallback,
  handleDecline,
  handleCancel,
  handleCharacter,
  handleCreateCharacter,
  handleDeleteCharacterConfirm,
  handleDeleteCharacterPrompt,
  handleDisputeCommand,
  handleHistory,
  handleHelp,
  handleRecord,
  handleStatus,
  handleStart,
  handleAccept,
  handleParsedDisputeCommand,
  handleReplyDisputeCommand,
  handleTextMessage,
  type NotificationMessage,
} from "@dm-bot/domain";

import type { TelegramMessage, TelegramUpdate } from "../../lib/telegram-types.js";

type TelegramUpdateDeps = {
  handleCallback: typeof handleCallback;
  handleDecline: typeof handleDecline;
  handleCancel: typeof handleCancel;
  handleCharacter: typeof handleCharacter;
  handleCreateCharacter: typeof handleCreateCharacter;
  handleDeleteCharacterConfirm: typeof handleDeleteCharacterConfirm;
  handleDeleteCharacterPrompt: typeof handleDeleteCharacterPrompt;
  handleDisputeCommand: typeof handleDisputeCommand;
  handleHistory: typeof handleHistory;
  handleHelp: typeof handleHelp;
  handleRecord: typeof handleRecord;
  handleStatus: typeof handleStatus;
  handleStart: typeof handleStart;
  handleAccept: typeof handleAccept;
  handleParsedDisputeCommand: typeof handleParsedDisputeCommand;
  handleReplyDisputeCommand: typeof handleReplyDisputeCommand;
  handleTextMessage: typeof handleTextMessage;
};

const defaultDeps: TelegramUpdateDeps = {
  handleCallback,
  handleDecline,
  handleCancel,
  handleCharacter,
  handleCreateCharacter,
  handleDeleteCharacterConfirm,
  handleDeleteCharacterPrompt,
  handleDisputeCommand,
  handleHistory,
  handleHelp,
  handleRecord,
  handleStatus,
  handleStart,
  handleAccept,
  handleParsedDisputeCommand,
  handleReplyDisputeCommand,
  handleTextMessage,
};

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

export async function processTelegramUpdate(
  app: FastifyInstance,
  update: TelegramUpdate,
  deps: TelegramUpdateDeps = defaultDeps,
) {
  if (update.callback_query?.from && update.callback_query.message?.chat.id) {
    const result = await deps.handleCallback(
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
    await app.telegram.sendMessage(chatId, await deps.handleStart(actor));
    return;
  }

  if (normalizedCommand === "/help") {
    await app.telegram.sendMessage(chatId, await deps.handleHelp());
    return;
  }

  if (normalizedCommand === "/status") {
    await app.telegram.sendMessage(chatId, await deps.handleStatus());
    return;
  }

  if (normalizedCommand === "/create_character") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Character creation works in DM right now. Open a private chat with the bot and send /create_character there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await deps.handleCreateCharacter(actor));
    return;
  }

  if (normalizedCommand === "/character") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Character sheets are shown in DM right now. Open a private chat with the bot and send /character there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await deps.handleCharacter(actor));
    return;
  }

  if (normalizedCommand === "/delete_character") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Character deletion works in DM right now. Open a private chat with the bot and send /delete_character there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await deps.handleDeleteCharacterPrompt(actor));
    return;
  }

  if (normalizedCommand === "/record") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Arena records are shown in DM right now. Open a private chat with the bot and send /record there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await deps.handleRecord(actor));
    return;
  }

  if (normalizedCommand === "/history") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Dispute history is shown in DM right now. Open a private chat with the bot and send /history there.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await deps.handleHistory(actor));
    return;
  }

  if (normalizedCommand === "/cancel") {
    if (!isPrivateChat) {
      await app.telegram.sendMessage(chatId, {
        text: "Use /cancel in DM to clear a private bot flow.",
      });
      return;
    }

    await app.telegram.sendMessage(chatId, await deps.handleCancel(actor));
    return;
  }

  if (normalizedCommand === "/dispute") {
    const result = await resolveDisputeCommand(actor, update.message, text, deps);
    await app.telegram.sendMessage(chatId, result.message);
    await sendNotifications(app, result.notifications ?? []);
    return;
  }

  if (normalizedCommand === "/accept") {
    const result = await deps.handleAccept(actor);
    await app.telegram.sendMessage(chatId, result.message);
    await sendNotifications(app, result.notifications ?? []);
    return;
  }

  if (normalizedCommand === "/decline") {
    const result = await deps.handleDecline(actor);
    await app.telegram.sendMessage(chatId, result.message);
    await sendNotifications(app, result.notifications ?? []);
    return;
  }

  if (!isPrivateChat) {
    return;
  }

  const sessionMessage = await deps.handleTextMessage(actor, text);

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
  deps: TelegramUpdateDeps,
) {
  const repliedUserId = message.reply_to_message?.from?.id;

  if (repliedUserId && !message.reply_to_message?.from?.is_bot) {
    return deps.handleReplyDisputeCommand({
      actor,
      text,
      repliedUserTelegramId: String(repliedUserId),
    });
  }

  const entityTarget = extractMentionTarget(message);

  if (entityTarget) {
    const reason = removeTargetFromDisputeText(text, entityTarget.rawText);

    return deps.handleDisputeCommand({
      actor,
      reason,
      target: entityTarget.target,
    });
  }

  return deps.handleParsedDisputeCommand(actor, text);
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

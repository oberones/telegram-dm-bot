import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";
import {
  beginTelegramUpdateProcessing,
  markTelegramUpdateFailed,
  markTelegramUpdateProcessed,
} from "@dm-bot/db";

import type { TelegramUpdate } from "../../lib/telegram-types.js";
import { processTelegramUpdate } from "./handle-update.js";

type TelegramHeaders = {
  "x-telegram-bot-api-secret-token"?: string;
};

type TelegramRouteDeps = {
  beginTelegramUpdateProcessing: typeof beginTelegramUpdateProcessing;
  markTelegramUpdateProcessed: typeof markTelegramUpdateProcessed;
  markTelegramUpdateFailed: typeof markTelegramUpdateFailed;
  processTelegramUpdate: typeof processTelegramUpdate;
};

const defaultDeps: TelegramRouteDeps = {
  beginTelegramUpdateProcessing,
  markTelegramUpdateProcessed,
  markTelegramUpdateFailed,
  processTelegramUpdate,
};

function summarizeUpdate(update: TelegramUpdate) {
  const message = update.message ?? update.callback_query?.message;
  const actor = update.message?.from ?? update.callback_query?.from;

  return {
    telegramChatId: message?.chat?.id ? String(message.chat.id) : null,
    telegramUserId: actor?.id ? String(actor.id) : null,
    updateType: update.callback_query ? "callback_query" : update.message ? "message" : "unknown",
  };
}

function formatErrorSummary(error: unknown) {
  if (error instanceof Error) {
    return error.message.slice(0, 500);
  }

  return String(error).slice(0, 500);
}

export function registerTelegramRoutes(app: FastifyInstance, deps: TelegramRouteDeps = defaultDeps) {
  app.post(
    "/telegram/webhook",
    async (
      request: FastifyRequest<{ Headers: TelegramHeaders; Body: TelegramUpdate }>,
      reply: FastifyReply,
    ) => {
      const secret = request.headers["x-telegram-bot-api-secret-token"];

      if (secret !== app.config.telegramWebhookSecret) {
        return reply.code(401).send({
          ok: false,
          error: "Invalid Telegram webhook secret",
        });
      }

      request.log.info({ body: request.body }, "Received Telegram webhook payload");

      const update = request.body;
      const metadata = summarizeUpdate(update);
      const processingState = await deps.beginTelegramUpdateProcessing({
        telegramUpdateId: update.update_id,
        telegramChatId: metadata.telegramChatId,
        telegramUserId: metadata.telegramUserId,
        updateType: metadata.updateType,
        rawPayload: update as unknown as Record<string, unknown>,
      });

      if (processingState === "skip") {
        return { ok: true };
      }

      try {
        await deps.processTelegramUpdate(app, update);
        await deps.markTelegramUpdateProcessed(update.update_id);
      } catch (error) {
        await deps.markTelegramUpdateFailed({
          telegramUpdateId: update.update_id,
          errorSummary: formatErrorSummary(error),
        });

        throw error;
      }

      return { ok: true };
    },
  );
}

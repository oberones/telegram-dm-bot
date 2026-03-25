import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import type { TelegramUpdate } from "../../lib/telegram-types.js";
import { processTelegramUpdate } from "./handle-update.js";

type TelegramHeaders = {
  "x-telegram-bot-api-secret-token"?: string;
};

export function registerTelegramRoutes(app: FastifyInstance) {
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
      await processTelegramUpdate(app, update);

      return { ok: true };
    },
  );
}

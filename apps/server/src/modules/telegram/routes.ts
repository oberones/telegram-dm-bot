import type { FastifyInstance, FastifyReply, FastifyRequest } from "fastify";

import { acknowledgeTelegramUpdate } from "@dm-bot/domain";

type TelegramHeaders = {
  "x-telegram-bot-api-secret-token"?: string;
};

export function registerTelegramRoutes(app: FastifyInstance) {
  app.post(
    "/telegram/webhook",
    async (
      request: FastifyRequest<{ Headers: TelegramHeaders }>,
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

      return acknowledgeTelegramUpdate();
    },
  );
}

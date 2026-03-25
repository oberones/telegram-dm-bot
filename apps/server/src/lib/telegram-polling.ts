import type { FastifyInstance } from "fastify";

import { processTelegramUpdate } from "../modules/telegram/handle-update.js";

export async function startTelegramPolling(app: FastifyInstance) {
  let offset: number | undefined;

  await app.telegram.deleteWebhook(false);
  app.log.info("Telegram polling mode enabled");

  while (true) {
    try {
      const response = await app.telegram.getUpdates(offset);

      for (const update of response.result) {
        await processTelegramUpdate(app, update);
        offset = update.update_id + 1;
      }
    } catch (error) {
      app.log.error(error, "Telegram polling cycle failed");
      await wait(2000);
    }
  }
}

function wait(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

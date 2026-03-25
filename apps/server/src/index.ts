import { buildApp } from "./lib/app.js";
import { startTelegramPolling } from "./lib/telegram-polling.js";

const app = buildApp();

async function main() {
  try {
    await app.listen({
      host: "0.0.0.0",
      port: app.config.port,
    });

    if (app.config.telegramDeliveryMode === "polling") {
      void startTelegramPolling(app);
    }
  } catch (error) {
    app.log.error(error);
    process.exitCode = 1;
  }
}

void main();

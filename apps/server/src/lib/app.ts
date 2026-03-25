import { pingDatabase } from "@dm-bot/db";
import Fastify from "fastify";

import { loadConfig } from "@dm-bot/shared";

import { TelegramClient } from "./telegram-client.js";
import { registerAdminApiRoutes } from "../modules/admin-api/routes.js";
import { registerHealthRoutes } from "../modules/health/routes.js";
import { registerTelegramRoutes } from "../modules/telegram/routes.js";

export function buildApp() {
  const config = loadConfig();
  const app = Fastify({
    logger: {
      level: config.logLevel,
    },
  });

  app.decorate("config", config);
  app.decorate("telegram", new TelegramClient(config));
  app.decorate("services", {
    pingDatabase,
  });

  registerHealthRoutes(app);
  registerTelegramRoutes(app);
  registerAdminApiRoutes(app);

  return app;
}

declare module "fastify" {
  interface FastifyInstance {
    config: ReturnType<typeof loadConfig>;
    telegram: TelegramClient;
    services: {
      pingDatabase: typeof pingDatabase;
    };
  }
}

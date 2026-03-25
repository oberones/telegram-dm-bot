import type { FastifyInstance } from "fastify";

import { buildReadinessSnapshot } from "@dm-bot/domain";
import type { HealthResponse, ReadyResponse } from "@dm-bot/shared";

export function registerHealthRoutes(app: FastifyInstance) {
  app.get("/health", async (): Promise<HealthResponse> => {
    return {
      status: "ok",
      service: "dungeon-master-bot-server",
      timestamp: new Date().toISOString(),
    };
  });

  app.get("/ready", async (): Promise<ReadyResponse> => {
    const databaseReady = await app.services.pingDatabase()
      .then(() => "ok" as const)
      .catch(() => "error" as const);

    const checks = buildReadinessSnapshot();

    return {
      status: "ok",
      service: "dungeon-master-bot-server",
      timestamp: new Date().toISOString(),
      checks: {
        ...checks,
        database: databaseReady,
      },
    };
  });
}

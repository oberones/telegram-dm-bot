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
    return {
      status: "ok",
      service: "dungeon-master-bot-server",
      timestamp: new Date().toISOString(),
      checks: buildReadinessSnapshot(),
    };
  });
}

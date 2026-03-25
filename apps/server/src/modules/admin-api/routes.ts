import type { FastifyInstance } from "fastify";

import { getDashboardCounts, getMatchById, listMatchEvents, listMatches } from "@dm-bot/db";
import { previewMatchResolution } from "@dm-bot/domain";

export function registerAdminApiRoutes(app: FastifyInstance) {
  app.get("/api/session", async () => {
    return {
      authenticated: false,
      message: "Admin authentication is not implemented yet.",
    };
  });

  app.get("/api/dashboard", async () => {
    const stats = await getDashboardCounts().catch(() => ({
      pendingDisputes: 0,
      runningMatches: 0,
      failedMatches: 0,
    }));

    return {
      system: {
        environment: app.config.appEnv,
        defaultRulesVersion: app.config.defaultRulesVersion,
      },
      stats,
      preview: previewMatchResolution(),
    };
  });

  app.get("/api/matches", async () => {
    return {
      matches: await listMatches(),
    };
  });

  app.get("/api/matches/:id", async (request) => {
    const { id } = request.params as { id: string };
    const match = await getMatchById(id);

    if (!match) {
      return {
        error: "Match not found",
      };
    }

    return {
      match,
      events: await listMatchEvents(id),
    };
  });
}

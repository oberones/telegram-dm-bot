import type { FastifyInstance } from "fastify";

import { previewMatchResolution } from "@dm-bot/domain";

export function registerAdminApiRoutes(app: FastifyInstance) {
  app.get("/api/session", async () => {
    return {
      authenticated: false,
      message: "Admin authentication is not implemented yet.",
    };
  });

  app.get("/api/dashboard", async () => {
    return {
      system: {
        environment: app.config.appEnv,
        defaultRulesVersion: app.config.defaultRulesVersion,
      },
      stats: {
        pendingDisputes: 0,
        runningMatches: 0,
        failedMatches: 0,
      },
      preview: previewMatchResolution(),
    };
  });
}

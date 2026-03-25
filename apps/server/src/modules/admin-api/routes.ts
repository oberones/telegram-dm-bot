import type { FastifyInstance } from "fastify";

import {
  getDashboardCounts,
  getMatchById,
  listCharacters,
  listDisputes,
  listMatchEvents,
  listMatchParticipants,
  listMatches,
  listUsers,
} from "@dm-bot/db";
import { previewMatchResolution } from "@dm-bot/domain";

import { getAdminAuthContext, loginAdmin, logoutAdmin, requireAdminAuth } from "../../lib/admin-auth.js";

export function registerAdminApiRoutes(app: FastifyInstance) {
  app.get("/api/session", async (request, reply) => {
    const auth = await getAdminAuthContext(app, request);

    if (!auth) {
      reply.code(401);
      return {
        authenticated: false,
      };
    }

    return {
      authenticated: true,
      adminUser: {
        id: auth.adminUser.id,
        email: auth.adminUser.email,
        displayName: auth.adminUser.display_name,
        role: auth.adminUser.role,
      },
    };
  });

  app.post("/api/login", async (request, reply) => {
    const body = (request.body ?? {}) as { email?: string; password?: string };

    if (!body.email || !body.password) {
      reply.code(400);
      return {
        error: "Email and password are required",
      };
    }

    return loginAdmin(app, request, reply, body.email, body.password);
  });

  app.post("/api/logout", async (request, reply) => {
    return logoutAdmin(app, request, reply);
  });

  app.get("/api/dashboard", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

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

  app.get("/api/matches", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      matches: await listMatches(),
    };
  });

  app.get("/api/disputes", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      disputes: await listDisputes(),
    };
  });

  app.get("/api/users", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      users: await listUsers(),
    };
  });

  app.get("/api/characters", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      characters: await listCharacters(),
    };
  });

  app.get("/api/matches/:id", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const { id } = request.params as { id: string };
    const match = await getMatchById(id);

    if (!match) {
      return {
        error: "Match not found",
      };
    }

    return {
      match,
      participants: await listMatchParticipants(id),
      events: await listMatchEvents(id),
    };
  });
}

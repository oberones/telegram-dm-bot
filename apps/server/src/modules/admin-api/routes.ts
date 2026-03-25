import type { FastifyInstance } from "fastify";

import {
  createAuditLog,
  getDashboardCounts,
  getMatchById,
  listCharacters,
  listDisputes,
  listAuditLogs,
  listMatchEvents,
  listMatchParticipants,
  listMatches,
  listUsers,
  setCharacterStatus,
  setUserStatus,
} from "@dm-bot/db";
import { previewMatchResolution } from "@dm-bot/domain";

import { getAdminAuthContext, loginAdmin, logoutAdmin, requireAdminAuth, requireAdminRole } from "../../lib/admin-auth.js";

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

  app.get("/api/audit-logs", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      auditLogs: await listAuditLogs(),
    };
  });

  app.post("/api/users/:id/status", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot change user status" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { status?: "active" | "suspended"; reason?: string };

    if (body.status !== "active" && body.status !== "suspended") {
      reply.code(400);
      return { error: "Unsupported user status" };
    }

    if (body.status === "suspended" && !body.reason?.trim()) {
      reply.code(400);
      return { error: "A suspension reason is required" };
    }

    const user = await setUserStatus({
      userId: id,
      status: body.status,
      suspendedReason: body.reason?.trim() ?? null,
    });

    if (!user) {
      reply.code(404);
      return { error: "User not found" };
    }

    await createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: body.status === "suspended" ? "user_suspended" : "user_activated",
      targetType: "user",
      targetId: id,
      reason: body.reason?.trim() ?? null,
      metadata: {
        nextStatus: body.status,
        targetDisplayName: user.display_name,
      },
    });

    return {
      user,
    };
  });

  app.post("/api/characters/:id/status", async (request, reply) => {
    const auth = await requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot change character status" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { status?: "active" | "frozen"; reason?: string };

    if (body.status !== "active" && body.status !== "frozen") {
      reply.code(400);
      return { error: "Unsupported character status" };
    }

    if (body.status === "frozen" && !body.reason?.trim()) {
      reply.code(400);
      return { error: "A freeze reason is required" };
    }

    const character = await setCharacterStatus({
      characterId: id,
      status: body.status,
      frozenReason: body.reason?.trim() ?? null,
    });

    if (!character) {
      reply.code(404);
      return { error: "Character not found" };
    }

    await createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: body.status === "frozen" ? "character_frozen" : "character_activated",
      targetType: "character",
      targetId: id,
      reason: body.reason?.trim() ?? null,
      metadata: {
        nextStatus: body.status,
        characterName: character.name,
      },
    });

    return {
      character,
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

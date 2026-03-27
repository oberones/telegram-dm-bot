import type { FastifyInstance } from "fastify";

import {
  cancelMatchByAdmin,
  cancelPendingDisputeByAdmin,
  createAuditLog,
  finalizeMatchByAdmin,
  getAdventureRunById,
  getCharacterById,
  getEncounterById,
  getDashboardCounts,
  getDisputeById,
  getMatchById,
  getPartyById,
  getRunRoomDetailById,
  getUserById,
  listEncountersForRun,
  listActiveAdventureRuns,
  listEquipmentLoadoutsForCharacter,
  listCharacters,
  listDisputes,
  listInventoryItemsForCharacter,
  listLootTemplates,
  listAuditLogs,
  listMatchEvents,
  listMatchParticipants,
  listPartyMemberDetails,
  listPartySummaries,
  listMatches,
  listRunRewardsForRun,
  listUsers,
  setCharacterStatus,
  setUserStatus,
  updateAdventureRun,
  updateEncounter,
  updateParty,
  updateRunRoom,
} from "@dm-bot/db";
import { previewMatchResolution } from "@dm-bot/domain";
import type { FastifyReply, FastifyRequest } from "fastify";

import { getAdminAuthContext, loginAdmin, logoutAdmin, requireAdminAuth, requireAdminRole } from "../../lib/admin-auth.js";
import {
  explainFlaggedCrawlerEncounter,
  explainFlaggedCrawlerRun,
  explainFlaggedDispute,
  explainFlaggedMatch,
  summarizeCrawlerRewards,
} from "./recovery.js";

type AdminRouteAuthContext = {
  adminUser: {
    id: string;
    role: "super_admin" | "operator" | "moderator";
    email: string;
    display_name: string;
  };
  sessionId: string;
};

type AdminRouteDeps = {
  getAdminAuthContext: typeof getAdminAuthContext;
  loginAdmin: typeof loginAdmin;
  logoutAdmin: typeof logoutAdmin;
  requireAdminAuth: (
    app: FastifyInstance,
    request: FastifyRequest,
    reply: FastifyReply,
  ) => Promise<AdminRouteAuthContext | null>;
  requireAdminRole: typeof requireAdminRole;
  getDashboardCounts: typeof getDashboardCounts;
  listMatches: typeof listMatches;
  listDisputes: typeof listDisputes;
  getDisputeById: typeof getDisputeById;
  cancelPendingDisputeByAdmin: typeof cancelPendingDisputeByAdmin;
  listUsers: typeof listUsers;
  listCharacters: typeof listCharacters;
  listPartySummaries: typeof listPartySummaries;
  listPartyMemberDetails: typeof listPartyMemberDetails;
  listActiveAdventureRuns: typeof listActiveAdventureRuns;
  getAdventureRunById: typeof getAdventureRunById;
  getEncounterById: typeof getEncounterById;
  getPartyById: typeof getPartyById;
  getRunRoomDetailById: typeof getRunRoomDetailById;
  listEncountersForRun: typeof listEncountersForRun;
  listRunRewardsForRun: typeof listRunRewardsForRun;
  listAuditLogs: typeof listAuditLogs;
  setUserStatus: typeof setUserStatus;
  setCharacterStatus: typeof setCharacterStatus;
  createAuditLog: typeof createAuditLog;
  updateAdventureRun: typeof updateAdventureRun;
  updateEncounter: typeof updateEncounter;
  updateParty: typeof updateParty;
  updateRunRoom: typeof updateRunRoom;
  getCharacterById: typeof getCharacterById;
  listInventoryItemsForCharacter: typeof listInventoryItemsForCharacter;
  listEquipmentLoadoutsForCharacter: typeof listEquipmentLoadoutsForCharacter;
  listLootTemplates: typeof listLootTemplates;
  listMatchParticipants: typeof listMatchParticipants;
  cancelMatchByAdmin: typeof cancelMatchByAdmin;
  finalizeMatchByAdmin: typeof finalizeMatchByAdmin;
  getUserById: typeof getUserById;
  getMatchById: typeof getMatchById;
  listMatchEvents: typeof listMatchEvents;
};

const defaultDeps: AdminRouteDeps = {
  getAdminAuthContext,
  loginAdmin,
  logoutAdmin,
  requireAdminAuth,
  requireAdminRole,
  getDashboardCounts,
  listMatches,
  listDisputes,
  getDisputeById,
  cancelPendingDisputeByAdmin,
  listUsers,
  listCharacters,
  listPartySummaries,
  listPartyMemberDetails,
  listActiveAdventureRuns,
  getAdventureRunById,
  getEncounterById,
  getPartyById,
  getRunRoomDetailById,
  listEncountersForRun,
  listRunRewardsForRun,
  listAuditLogs,
  setUserStatus,
  setCharacterStatus,
  createAuditLog,
  updateAdventureRun,
  updateEncounter,
  updateParty,
  updateRunRoom,
  getCharacterById,
  listInventoryItemsForCharacter,
  listEquipmentLoadoutsForCharacter,
  listLootTemplates,
  listMatchParticipants,
  cancelMatchByAdmin,
  finalizeMatchByAdmin,
  getUserById,
  getMatchById,
  listMatchEvents,
};

export function registerAdminApiRoutes(app: FastifyInstance, deps: AdminRouteDeps = defaultDeps) {
  app.get("/api/session", async (request, reply) => {
    const auth = await deps.getAdminAuthContext(app, request);

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

    return deps.loginAdmin(app, request, reply, body.email, body.password);
  });

  app.post("/api/logout", async (request, reply) => {
    return deps.logoutAdmin(app, request, reply);
  });

  app.get("/api/dashboard", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const stats = await deps.getDashboardCounts().catch(() => ({
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
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      matches: (await deps.listMatches()).map((match) => ({
        ...match,
        recovery_hint: explainFlaggedMatch({
          status: match.status,
          endReason: match.end_reason,
          errorSummary: match.error_summary ?? null,
        }),
      })),
    };
  });

  app.get("/api/disputes", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      disputes: (await deps.listDisputes()).map((dispute) => ({
        ...dispute,
        recovery_hint: explainFlaggedDispute(dispute.status),
      })),
    };
  });

  app.get("/api/parties", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const parties = await deps.listPartySummaries();
    const withMembers = await Promise.all(
      parties.map(async (party) => ({
        ...party,
        members: await deps.listPartyMemberDetails(party.id),
      })),
    );

    return {
      parties: withMembers,
    };
  });

  app.get("/api/runs", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      runs: (await deps.listActiveAdventureRuns()).map((run) => ({
        ...run,
        recovery_hint: explainFlaggedCrawlerRun({
          status: run.status,
          currentRoomId: run.current_room_id,
          activeEncounterId: run.active_encounter_id,
          failureReason: run.failure_reason,
        }),
      })),
    };
  });

  app.get("/api/runs/:id/rewards", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const { id } = request.params as { id: string };

    return {
      rewards: await deps.listRunRewardsForRun(id),
    };
  });

  app.get("/api/runs/:id/recovery", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const { id } = request.params as { id: string };
    const run = await deps.getAdventureRunById(id);

    if (!run) {
      reply.code(404);
      return {
        error: "Crawler run not found",
      };
    }

    const [currentRoom, encounters, rewards] = await Promise.all([
      run.current_room_id ? deps.getRunRoomDetailById(run.current_room_id) : Promise.resolve(null),
      deps.listEncountersForRun(run.id),
      deps.listRunRewardsForRun(run.id),
    ]);

    const recoveryHint = explainFlaggedCrawlerRun({
      status: run.status,
      currentRoomId: run.current_room_id,
      activeEncounterId: run.active_encounter_id,
      failureReason: run.failure_reason,
    });

    return {
      run: {
        ...run,
        recovery_hint: recoveryHint,
      },
      currentRoom,
      recovery_hint: recoveryHint,
      encounters: encounters.map((encounter) => ({
        ...encounter,
        recovery_hint: explainFlaggedCrawlerEncounter({
          status: encounter.status,
          errorSummary: encounter.error_summary,
        }),
      })),
      rewards,
      reward_summary: summarizeCrawlerRewards(rewards),
    };
  });

  app.get("/api/characters/:id/crawler-loadout", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const { id } = request.params as { id: string };
    const character = await deps.getCharacterById(id);

    if (!character) {
      reply.code(404);
      return {
        error: "Character not found",
      };
    }

    const [inventoryItems, loadouts, lootTemplates] = await Promise.all([
      deps.listInventoryItemsForCharacter(id),
      deps.listEquipmentLoadoutsForCharacter(id),
      deps.listLootTemplates(),
    ]);

    const lootById = new Map(lootTemplates.map((template) => [template.id, template]));
    const inventory = inventoryItems.map((item) => ({
      ...item,
      lootTemplate: item.loot_template_id ? lootById.get(item.loot_template_id) ?? null : null,
    }));

    return {
      character,
      inventory,
      loadouts,
    };
  });

  app.post("/api/disputes/:id/cancel", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot cancel disputes" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!reason) {
      reply.code(400);
      return { error: "A cancellation reason is required" };
    }

    const existingDispute = await deps.getDisputeById(id);

    if (!existingDispute) {
      reply.code(404);
      return { error: "Dispute not found" };
    }

    const dispute = await deps.cancelPendingDisputeByAdmin(id);

    if (!dispute) {
      reply.code(409);
      return { error: "Only pending disputes can be cancelled" };
    }

    await deps.createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: "dispute_cancelled_by_admin",
      targetType: "dispute",
      targetId: dispute.id,
      reason,
      metadata: {
        challengerUserId: dispute.challenger_user_id,
        targetUserId: dispute.target_user_id,
      },
    });

    const [challengerUser, targetUser] = await Promise.all([
      deps.getUserById(dispute.challenger_user_id),
      deps.getUserById(dispute.target_user_id),
    ]);

    const notificationText = [
      "An administrator cancelled a pending dispute.",
      `Reason: ${reason}`,
      `Original dispute reason: ${existingDispute.reason}`,
    ].join("\n");

    if (challengerUser) {
      await app.telegram.sendMessage(challengerUser.telegram_user_id, {
        text: notificationText,
      });
    }

    if (targetUser) {
      await app.telegram.sendMessage(targetUser.telegram_user_id, {
        text: notificationText,
      });
    }

    return {
      dispute,
    };
  });

  app.post("/api/matches/:id/cancel", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot cancel matches" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!reason) {
      reply.code(400);
      return { error: "A cancellation reason is required" };
    }

    const participants = await deps.listMatchParticipants(id);
    const match = await deps.cancelMatchByAdmin({ matchId: id, reason });

    if (!match) {
      reply.code(409);
      return { error: "Only queued, running, or errored matches can be cancelled" };
    }

    await deps.createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: "match_cancelled_by_admin",
      targetType: "match",
      targetId: match.id,
      reason,
      metadata: {
        previousRecoveryState: "flagged_match",
      },
    });

    const notificationText = [
      "An administrator cancelled a match that required recovery.",
      `Reason: ${reason}`,
    ].join("\n");

    for (const participant of participants) {
      const user = await deps.getUserById(participant.user_id);

      if (user) {
        await app.telegram.sendMessage(user.telegram_user_id, {
          text: notificationText,
        });
      }
    }

    return {
      match,
    };
  });

  app.post("/api/matches/:id/finalize", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot finalize matches" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string; winnerCharacterId?: string };
    const reason = body.reason?.trim();
    const winnerCharacterId = body.winnerCharacterId?.trim();

    if (!reason || !winnerCharacterId) {
      reply.code(400);
      return { error: "A winner and finalization reason are required" };
    }

    const participants = await deps.listMatchParticipants(id);

    if (!participants.some((participant) => participant.character_id === winnerCharacterId)) {
      reply.code(400);
      return { error: "Selected winner is not a participant in this match" };
    }

    const match = await deps.finalizeMatchByAdmin({
      matchId: id,
      winnerCharacterId,
      reason,
    });

    if (!match) {
      reply.code(409);
      return { error: "Only queued, running, or errored matches can be finalized" };
    }

    const winner = participants.find((participant) => participant.character_id === winnerCharacterId);

    await deps.createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: "match_finalized_by_admin",
      targetType: "match",
      targetId: match.id,
      reason,
      metadata: {
        winnerCharacterId,
        winnerCharacterName: winner?.character_name ?? null,
      },
    });

    const notificationText = [
      "An administrator finalized a match that required recovery.",
      `Winner: ${winner?.character_name ?? "Unknown"}`,
      `Reason: ${reason}`,
    ].join("\n");

    for (const participant of participants) {
      const user = await deps.getUserById(participant.user_id);

      if (user) {
        await app.telegram.sendMessage(user.telegram_user_id, {
          text: notificationText,
        });
      }
    }

    return {
      match,
    };
  });

  app.post("/api/runs/:id/fail", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot fail crawler runs" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!reason) {
      reply.code(400);
      return { error: "A crawler run failure reason is required" };
    }

    const run = await deps.getAdventureRunById(id);

    if (!run) {
      reply.code(404);
      return { error: "Crawler run not found" };
    }

    if (["completed", "failed", "abandoned", "cancelled"].includes(run.status)) {
      reply.code(409);
      return { error: "Only active, paused, or errored crawler runs can be failed" };
    }

    const party = await deps.getPartyById(run.party_id);

    if (!party) {
      reply.code(404);
      return { error: "Crawler party not found" };
    }

    const [members, encounters, currentRoom] = await Promise.all([
      deps.listPartyMemberDetails(party.id),
      deps.listEncountersForRun(run.id),
      run.current_room_id ? deps.getRunRoomDetailById(run.current_room_id) : Promise.resolve(null),
    ]);

    await Promise.all(
      encounters
        .filter((encounter) => ["queued", "active", "error"].includes(encounter.status))
        .map((encounter) => deps.updateEncounter({
          encounterId: encounter.id,
          status: "cancelled",
        })),
    );

    if (currentRoom && currentRoom.resolved_at === null && currentRoom.status !== "failed") {
      await deps.updateRunRoom({
        roomId: currentRoom.id,
        status: "failed",
        resolved: true,
      });
    }

    const failedRun = await deps.updateAdventureRun({
      runId: run.id,
      status: "failed",
      currentFloorNumber: currentRoom?.floor_number ?? run.current_floor_number ?? null,
      currentRoomId: currentRoom?.id ?? run.current_room_id ?? null,
      activeEncounterId: null,
      failureReason: reason,
      summary: {
        ...(run.summary ?? {}),
        adminRecovery: {
          action: "run_failed_by_admin",
          reason,
          actorAdminUserId: auth.adminUser.id,
          failedAt: new Date().toISOString(),
        },
      },
    });

    await deps.updateParty({
      partyId: party.id,
      status: "abandoned",
      activeRunId: null,
    });

    await deps.createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: "crawler_run_failed_by_admin",
      targetType: "adventure_run",
      targetId: run.id,
      reason,
      metadata: {
        partyId: party.id,
        previousStatus: run.status,
        currentRoomId: run.current_room_id,
        cancelledEncounterCount: encounters.filter((encounter) => ["queued", "active", "error"].includes(encounter.status)).length,
      },
    });

    const notificationText = [
      "An administrator closed a crawler run that required recovery.",
      `Run: ${run.id}`,
      `Reason: ${reason}`,
    ].join("\n");

    for (const member of members) {
      const user = await deps.getUserById(member.user_id);

      if (user) {
        await app.telegram.sendMessage(user.telegram_user_id, {
          text: notificationText,
        });
      }
    }

    return {
      run: failedRun ?? run,
    };
  });

  app.post("/api/runs/:id/cancel", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot cancel crawler runs" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!reason) {
      reply.code(400);
      return { error: "A crawler run cancellation reason is required" };
    }

    const run = await deps.getAdventureRunById(id);

    if (!run) {
      reply.code(404);
      return { error: "Crawler run not found" };
    }

    if (["completed", "failed", "abandoned", "cancelled"].includes(run.status)) {
      reply.code(409);
      return { error: "Only active, paused, or errored crawler runs can be cancelled" };
    }

    const party = await deps.getPartyById(run.party_id);

    if (!party) {
      reply.code(404);
      return { error: "Crawler party not found" };
    }

    const [members, encounters, currentRoom] = await Promise.all([
      deps.listPartyMemberDetails(party.id),
      deps.listEncountersForRun(run.id),
      run.current_room_id ? deps.getRunRoomDetailById(run.current_room_id) : Promise.resolve(null),
    ]);

    const cancellableEncounters = encounters.filter((encounter) => ["queued", "active", "error"].includes(encounter.status));

    await Promise.all(
      cancellableEncounters.map((encounter) => deps.updateEncounter({
        encounterId: encounter.id,
        status: "cancelled",
      })),
    );

    if (currentRoom && currentRoom.resolved_at === null && currentRoom.status !== "failed" && currentRoom.status !== "skipped") {
      await deps.updateRunRoom({
        roomId: currentRoom.id,
        status: "skipped",
        resolved: true,
      });
    }

    const cancelledRun = await deps.updateAdventureRun({
      runId: run.id,
      status: "cancelled",
      currentFloorNumber: currentRoom?.floor_number ?? run.current_floor_number ?? null,
      currentRoomId: currentRoom?.id ?? run.current_room_id ?? null,
      activeEncounterId: null,
      failureReason: reason,
      summary: {
        ...(run.summary ?? {}),
        adminRecovery: {
          action: "run_cancelled_by_admin",
          reason,
          actorAdminUserId: auth.adminUser.id,
          cancelledAt: new Date().toISOString(),
        },
      },
    });

    await deps.updateParty({
      partyId: party.id,
      status: "cancelled",
      activeRunId: null,
    });

    await deps.createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: "crawler_run_cancelled_by_admin",
      targetType: "adventure_run",
      targetId: run.id,
      reason,
      metadata: {
        partyId: party.id,
        previousStatus: run.status,
        currentRoomId: run.current_room_id,
        cancelledEncounterCount: cancellableEncounters.length,
      },
    });

    const notificationText = [
      "An administrator cancelled a crawler run.",
      `Run: ${run.id}`,
      `Reason: ${reason}`,
    ].join("\n");

    for (const member of members) {
      const user = await deps.getUserById(member.user_id);

      if (user) {
        await app.telegram.sendMessage(user.telegram_user_id, {
          text: notificationText,
        });
      }
    }

    return {
      run: cancelledRun ?? run,
    };
  });

  app.post("/api/encounters/:id/error", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
      reply.code(403);
      return { error: "Your role cannot mark crawler encounters as errored" };
    }

    const { id } = request.params as { id: string };
    const body = (request.body ?? {}) as { reason?: string };
    const reason = body.reason?.trim();

    if (!reason) {
      reply.code(400);
      return { error: "An encounter recovery reason is required" };
    }

    const encounter = await deps.getEncounterById(id);

    if (!encounter) {
      reply.code(404);
      return { error: "Crawler encounter not found" };
    }

    if (["completed", "failed", "cancelled"].includes(encounter.status)) {
      reply.code(409);
      return { error: "Only queued, active, or errored encounters can be administratively marked" };
    }

    const run = await deps.getAdventureRunById(encounter.run_id);

    if (!run) {
      reply.code(404);
      return { error: "Crawler run not found" };
    }

    if (["completed", "failed", "abandoned", "cancelled"].includes(run.status)) {
      reply.code(409);
      return { error: "The parent crawler run is already terminal" };
    }

    const party = await deps.getPartyById(run.party_id);

    if (!party) {
      reply.code(404);
      return { error: "Crawler party not found" };
    }

    const members = await deps.listPartyMemberDetails(party.id);
    const updatedEncounter = await deps.updateEncounter({
      encounterId: encounter.id,
      status: "error",
      errorSummary: reason,
    });

    const pausedRun = await deps.updateAdventureRun({
      runId: run.id,
      status: "paused",
      activeEncounterId: run.active_encounter_id === encounter.id ? null : run.active_encounter_id,
      summary: {
        ...(run.summary ?? {}),
        adminRecovery: {
          action: "encounter_marked_error_by_admin",
          reason,
          actorAdminUserId: auth.adminUser.id,
          encounterId: encounter.id,
          updatedAt: new Date().toISOString(),
        },
      },
    });

    await deps.createAuditLog({
      actorType: "admin_user",
      actorAdminUserId: auth.adminUser.id,
      action: "crawler_encounter_marked_error_by_admin",
      targetType: "encounter",
      targetId: encounter.id,
      reason,
      metadata: {
        runId: run.id,
        roomId: encounter.room_id,
        previousEncounterStatus: encounter.status,
        previousRunStatus: run.status,
      },
    });

    const notificationText = [
      "An administrator paused a crawler run for recovery review.",
      `Run: ${run.id}`,
      `Encounter: ${encounter.id}`,
      `Reason: ${reason}`,
    ].join("\n");

    for (const member of members) {
      const user = await deps.getUserById(member.user_id);

      if (user) {
        await app.telegram.sendMessage(user.telegram_user_id, {
          text: notificationText,
        });
      }
    }

    return {
      encounter: updatedEncounter ?? encounter,
      run: pausedRun ?? run,
    };
  });

  app.get("/api/users", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      users: await deps.listUsers(),
    };
  });

  app.get("/api/characters", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      characters: await deps.listCharacters(),
    };
  });

  app.get("/api/audit-logs", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    return {
      auditLogs: await deps.listAuditLogs(),
    };
  });

  app.post("/api/users/:id/status", async (request, reply) => {
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
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

    const user = await deps.setUserStatus({
      userId: id,
      status: body.status,
      suspendedReason: body.reason?.trim() ?? null,
    });

    if (!user) {
      reply.code(404);
      return { error: "User not found" };
    }

    await deps.createAuditLog({
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
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    if (!deps.requireAdminRole(auth.adminUser.role, ["super_admin", "operator"])) {
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

    const character = await deps.setCharacterStatus({
      characterId: id,
      status: body.status,
      frozenReason: body.reason?.trim() ?? null,
    });

    if (!character) {
      reply.code(404);
      return { error: "Character not found" };
    }

    await deps.createAuditLog({
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
    const auth = await deps.requireAdminAuth(app, request, reply);

    if (!auth) {
      return {
        error: "Unauthorized",
      };
    }

    const { id } = request.params as { id: string };
    const match = await deps.getMatchById(id);

    if (!match) {
      return {
        error: "Match not found",
      };
    }

    return {
      match,
      participants: await deps.listMatchParticipants(id),
      events: await deps.listMatchEvents(id),
      recovery_hint: explainFlaggedMatch({
        status: match.status,
        endReason: match.end_reason,
        errorSummary: match.error_summary ?? null,
      }),
    };
  });
}

import { randomUUID } from "node:crypto";

import {
  addPartyMember,
  createAdventureRun,
  createAuditLog,
  createParty,
  createRunChoice,
  createRunFloor,
  createRunRoom,
  ensureRulesVersion,
  getActivePartyForUser,
  getAdventureRunById,
  getEligibleCharacterByUserId,
  getPartyById,
  getPartyMemberByPartyAndUser,
  getRunRoomDetailById,
  getUserById,
  listPartyMemberDetails,
  listRunRoomDetails,
  setPartyMemberLeft,
  setPartyMemberReadyState,
  setPartyMemberStatus,
  updateAdventureRun,
  updateParty,
  updateRunRoom,
  upsertTelegramUser,
  type AdventureRunRecord,
  type PartyMemberDetailRecord,
  type PartyRecord,
  type RunRoomDetailRecord,
} from "@dm-bot/db";
import { generateRun, type GeneratedRun, type GeneratedRoom } from "@dm-bot/crawler-generation";

export type CrawlerOutboundMessage = {
  text: string;
  replyMarkup?: {
    inline_keyboard: Array<Array<{ text: string; callback_data: string }>>;
  };
};

export type CrawlerCommandResult = {
  alertText?: string;
  message?: CrawlerOutboundMessage;
};

export type TelegramActor = {
  telegramUserId: string;
  telegramUsername?: string | undefined;
  telegramFirstName?: string | undefined;
  telegramLastName?: string | undefined;
};

export type CrawlerPartyEligibility = {
  userStatus: "active" | "suspended";
  characterStatus: "active" | "frozen" | "retired";
  alreadyInActiveRun: boolean;
};

export type CrawlerPartyStartCheck = {
  memberCount: number;
  readyMemberCount: number;
  minimumMembers?: number;
  maximumMembers?: number;
};

const ACTIVE_PARTY_MEMBER_STATUSES = new Set<PartyMemberDetailRecord["status"]>(["joined", "ready"]);

export function isEligibleForCrawlerParty(input: CrawlerPartyEligibility): boolean {
  return (
    input.userStatus === "active" &&
    input.characterStatus === "active" &&
    input.alreadyInActiveRun === false
  );
}

export function canStartCrawlerParty(input: CrawlerPartyStartCheck): boolean {
  const minimumMembers = input.minimumMembers ?? 1;
  const maximumMembers = input.maximumMembers ?? 4;

  return (
    input.memberCount >= minimumMembers &&
    input.memberCount <= maximumMembers &&
    input.readyMemberCount === input.memberCount
  );
}

function displayName(actor: TelegramActor) {
  const name = [actor.telegramFirstName, actor.telegramLastName].filter(Boolean).join(" ").trim();

  return name || actor.telegramUsername || `telegram-${actor.telegramUserId}`;
}

async function ensureUser(actor: TelegramActor) {
  return upsertTelegramUser({
    telegramUserId: actor.telegramUserId,
    telegramUsername: actor.telegramUsername,
    telegramFirstName: actor.telegramFirstName,
    telegramLastName: actor.telegramLastName,
    displayName: displayName(actor),
  });
}

function restrictedUserMessage() {
  return "Your crawler access is currently restricted. Please contact an administrator if you believe this is a mistake.";
}

function createPartyButtons() {
  return {
    inline_keyboard: [[{ text: "Create Party", callback_data: "crawler:party:create" }]],
  };
}

function activeMembers(members: PartyMemberDetailRecord[]) {
  return members.filter((member) => ACTIVE_PARTY_MEMBER_STATUSES.has(member.status));
}

function partyStatusForMembers(members: PartyMemberDetailRecord[]): PartyRecord["status"] {
  const currentMembers = activeMembers(members);

  if (currentMembers.length === 0) {
    return "cancelled";
  }

  const readyCount = currentMembers.filter((member) => member.status === "ready").length;
  return canStartCrawlerParty({
    memberCount: currentMembers.length,
    readyMemberCount: readyCount,
  })
    ? "ready"
    : "forming";
}

async function syncPartyStatus(partyId: string) {
  const members = await listPartyMemberDetails(partyId);
  const nextStatus = partyStatusForMembers(members);
  await updateParty({
    partyId,
    status: nextStatus,
  });
}

function formatPartyLobby(
  party: PartyRecord,
  members: PartyMemberDetailRecord[],
  viewerUserId: string,
  leaderDisplayName: string,
) {
  const currentMembers = activeMembers(members);
  const viewerMembership = currentMembers.find((member) => member.user_id === viewerUserId);
  const readyCount = currentMembers.filter((member) => member.status === "ready").length;
  const allReady = canStartCrawlerParty({
    memberCount: currentMembers.length,
    readyMemberCount: readyCount,
  });

  const lines = [
    "Crawler Party Lobby",
    "",
    `Leader: ${leaderDisplayName}`,
    `Status: ${party.status.replaceAll("_", " ")}`,
    `Members: ${currentMembers.length}/4`,
    "",
    ...currentMembers.map((member, index) => {
      const handle = member.telegram_username ? `@${member.telegram_username}` : member.user_display_name;
      const marker = member.status === "ready" ? "ready" : "waiting";
      return `${index + 1}. ${member.character_name} (${member.class_key}) - ${handle} - ${marker}`;
    }),
  ];

  if (party.status === "in_run" && party.active_run_id) {
    lines.push("");
    lines.push(`Active run: ${party.active_run_id}`);
    lines.push("This party has already entered the dungeon.");
  } else {
    lines.push("");
    lines.push(allReady ? "Everyone is ready. The leader can start the run." : "Ready up when your character is prepared.");
  }

  const buttons: Array<Array<{ text: string; callback_data: string }>> = [];

  if (party.status !== "in_run") {
    if (!viewerMembership) {
      buttons.push([{ text: "Join Party", callback_data: `crawler:party:join:${party.id}` }]);
    } else {
      buttons.push([
        {
          text: viewerMembership.status === "ready" ? "Not Ready" : "Ready Up",
          callback_data: `crawler:party:ready:${party.id}`,
        },
      ]);
      buttons.push([{ text: "Leave Party", callback_data: `crawler:party:leave:${party.id}` }]);
    }

    if (party.leader_user_id === viewerUserId && allReady) {
      buttons.push([{ text: "Start Run", callback_data: `crawler:party:start:${party.id}` }]);
    }
  }

  return {
    text: lines.join("\n"),
    ...(buttons.length > 0 ? { replyMarkup: { inline_keyboard: buttons } } : {}),
  } satisfies CrawlerOutboundMessage;
}

function roomActionLabel(roomType: RunRoomDetailRecord["room_type"]) {
  switch (roomType) {
    case "combat":
      return "Advance";
    case "elite_combat":
      return "Press Forward";
    case "treasure":
      return "Open Cache";
    case "event":
      return "Investigate";
    case "rest":
      return "Take Rest";
    case "boss":
      return "Confront Boss";
  }
}

function formatActiveRoomPrompt(
  run: AdventureRunRecord,
  room: RunRoomDetailRecord,
  memberCount: number,
) {
  const prompt = room.prompt_payload as {
    title?: string;
    description?: string;
    roomType?: string;
    templateKey?: string;
  };

  const lines = [
    "Crawler Run",
    "",
    `Run ID: ${run.id}`,
    `Theme: ${run.theme_key ?? "unknown"}`,
    `Party size: ${memberCount}`,
    "",
    prompt.title ?? `Floor ${room.floor_number}, Room ${room.room_number}`,
    prompt.description ?? "A new chamber lies ahead.",
    `Room type: ${(prompt.roomType ?? room.room_type).replaceAll("_", " ")}`,
  ];

  return {
    text: lines.join("\n"),
    replyMarkup: {
      inline_keyboard: [[{
        text: roomActionLabel(room.room_type),
        callback_data: `crawler:run:proceed:${room.id}`,
      }]],
    },
  } satisfies CrawlerOutboundMessage;
}

function formatRunCompleteMessage(run: AdventureRunRecord, room: RunRoomDetailRecord, memberCount: number) {
  return {
    text: [
      "Crawler Run Complete",
      "",
      `Run ID: ${run.id}`,
      `Theme: ${run.theme_key ?? "unknown"}`,
      `Party size: ${memberCount}`,
      "",
      `The party cleared Floor ${room.floor_number}, Room ${room.room_number} and emerged from the dungeon.`,
      "This is the current C3 exploration loop endpoint. Encounters and rewards arrive in later slices.",
    ].join("\n"),
  } satisfies CrawlerOutboundMessage;
}

async function buildPartyLobbyMessage(party: PartyRecord, viewerUserId: string): Promise<CrawlerOutboundMessage> {
  const [members, leader] = await Promise.all([
    listPartyMemberDetails(party.id),
    getUserById(party.leader_user_id),
  ]);

  return formatPartyLobby(party, members, viewerUserId, leader?.display_name ?? "Unknown leader");
}

async function buildRunMessage(runId: string): Promise<CrawlerOutboundMessage> {
  const run = await getAdventureRunById(runId);

  if (!run) {
    return {
      text: "The active crawler run could not be found.",
    };
  }

  const [rooms, members] = await Promise.all([
    listRunRoomDetails(run.id),
    getPartyById(run.party_id).then((party) => party ? listPartyMemberDetails(party.id) : []),
  ]);
  const currentRoom = rooms.find((room) => room.id === run.current_room_id) ?? rooms[0];
  const memberCount = activeMembers(members).length;

  if (!currentRoom) {
    return {
      text: [
        "Crawler Run",
        "",
        `Run ID: ${run.id}`,
        "No active room is currently available.",
      ].join("\n"),
    };
  }

  if (run.status === "completed") {
    return formatRunCompleteMessage(run, currentRoom, memberCount);
  }

  return formatActiveRoomPrompt(run, currentRoom, memberCount);
}

async function persistGeneratedRun(runId: string, generated: GeneratedRun) {
  const createdRooms: RunRoomDetailRecord[] = [];

  for (const floor of generated.floors) {
    const persistedFloor = await createRunFloor({
      runId,
      floorNumber: floor.floorNumber,
      seedFragment: floor.seedFragment,
      metadata: floor.metadata,
    });

    for (const room of floor.rooms) {
      const persistedRoom = await createRunRoom({
        runId,
        floorId: persistedFloor.id,
        roomNumber: room.roomNumber,
        roomType: room.roomType,
        status: "unvisited",
        templateKey: room.templateKey,
        promptPayload: room.promptPayload,
        generationPayload: room.generationPayload,
      });

      createdRooms.push({
        ...persistedRoom,
        floor_number: floor.floorNumber,
      });
    }
  }

  return createdRooms.sort((left, right) => {
    if (left.floor_number !== right.floor_number) {
      return left.floor_number - right.floor_number;
    }

    return left.room_number - right.room_number;
  });
}

async function activateRoom(run: AdventureRunRecord, room: RunRoomDetailRecord) {
  await updateRunRoom({
    roomId: room.id,
    status: "active",
    entered: true,
  });

  return updateAdventureRun({
    runId: run.id,
    status: "awaiting_choice",
    currentFloorNumber: room.floor_number,
    currentRoomId: room.id,
  });
}

function nextRoom(rooms: RunRoomDetailRecord[], currentRoomId: string) {
  const currentIndex = rooms.findIndex((room) => room.id === currentRoomId);

  if (currentIndex === -1) {
    return null;
  }

  return rooms[currentIndex + 1] ?? null;
}

export async function handlePartyCommand(actor: TelegramActor): Promise<CrawlerOutboundMessage> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      text: restrictedUserMessage(),
    };
  }

  const existingParty = await getActivePartyForUser(user.id);

  if (existingParty) {
    if (existingParty.status === "in_run" && existingParty.active_run_id) {
      return buildRunMessage(existingParty.active_run_id);
    }

    return buildPartyLobbyMessage(existingParty, user.id);
  }

  const character = await getEligibleCharacterByUserId(user.id);

  if (!character) {
    return {
      text: [
        "You need an active character before you can join a crawler party.",
        "",
        "Create one in DM with /create_character first.",
      ].join("\n"),
    };
  }

  return {
    text: [
      "No active crawler party found for you.",
      "",
      `Current character: ${character.name} (${character.class_key})`,
      "",
      "Create a party to begin assembling an adventure group.",
    ].join("\n"),
    replyMarkup: createPartyButtons(),
  };
}

export async function handleCrawlerCallback(
  actor: TelegramActor,
  callbackData: string,
): Promise<CrawlerCommandResult> {
  const user = await ensureUser(actor);

  if (user.status !== "active") {
    return {
      alertText: "Your crawler access is restricted",
      message: { text: restrictedUserMessage() },
    };
  }

  if (callbackData === "crawler:party:create") {
    const existingParty = await getActivePartyForUser(user.id);

    if (existingParty) {
      return {
        alertText: "You are already in an active party",
        message: existingParty.status === "in_run" && existingParty.active_run_id
          ? await buildRunMessage(existingParty.active_run_id)
          : await buildPartyLobbyMessage(existingParty, user.id),
      };
    }

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "Create a character first",
        message: {
          text: "You need an active character before creating a crawler party. Use /create_character in DM first.",
        },
      };
    }

    const party = await createParty({
      leaderUserId: user.id,
      partyName: `${user.display_name}'s party`,
    });

    await addPartyMember({
      partyId: party.id,
      userId: user.id,
      characterId: character.id,
    });

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_party_created",
      targetType: "party",
      targetId: party.id,
      metadata: {
        characterId: character.id,
      },
    });

    return {
      alertText: "Party created",
      message: await buildPartyLobbyMessage(party, user.id),
    };
  }

  if (callbackData.startsWith("crawler:party:join:")) {
    const partyId = callbackData.slice("crawler:party:join:".length);
    const party = await getPartyById(partyId);

    if (!party || !["forming", "ready"].includes(party.status)) {
      return {
        alertText: "This party is no longer accepting members",
      };
    }

    const existingParty = await getActivePartyForUser(user.id);

    if (existingParty?.id && existingParty.id !== party.id) {
      return {
        alertText: "Leave your current party first",
        message: existingParty.status === "in_run" && existingParty.active_run_id
          ? await buildRunMessage(existingParty.active_run_id)
          : await buildPartyLobbyMessage(existingParty, user.id),
      };
    }

    const existingMember = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (existingMember && ACTIVE_PARTY_MEMBER_STATUSES.has(existingMember.status)) {
      return {
        alertText: "You are already in this party",
        message: await buildPartyLobbyMessage(party, user.id),
      };
    }

    const character = await getEligibleCharacterByUserId(user.id);

    if (!character) {
      return {
        alertText: "Create a character first",
        message: {
          text: "You need an active character before joining a crawler party. Use /create_character in DM first.",
        },
      };
    }

    if (existingMember) {
      await setPartyMemberStatus({
        partyMemberId: existingMember.id,
        status: "joined",
      });
    } else {
      await addPartyMember({
        partyId: party.id,
        userId: user.id,
        characterId: character.id,
      });
    }

    await syncPartyStatus(party.id);

    return {
      alertText: "Joined party",
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party, user.id),
    };
  }

  if (callbackData.startsWith("crawler:party:ready:")) {
    const partyId = callbackData.slice("crawler:party:ready:".length);
    const party = await getPartyById(partyId);

    if (!party || party.status === "in_run") {
      return {
        alertText: "This party is no longer in the lobby",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    const willBeReady = membership.status !== "ready";
    await setPartyMemberReadyState(membership.id, willBeReady);
    await syncPartyStatus(party.id);

    return {
      alertText: willBeReady ? "You are ready" : "You are no longer ready",
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party, user.id),
    };
  }

  if (callbackData.startsWith("crawler:party:leave:")) {
    const partyId = callbackData.slice("crawler:party:leave:".length);
    const party = await getPartyById(partyId);

    if (!party || party.status === "in_run") {
      return {
        alertText: "This party can no longer be changed",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not in this party",
      };
    }

    await setPartyMemberLeft(membership.id);
    const remainingMembers = activeMembers(await listPartyMemberDetails(party.id));

    if (party.leader_user_id === user.id || remainingMembers.length === 0) {
      await updateParty({
        partyId: party.id,
        status: "cancelled",
        activeRunId: null,
      });

      return {
        alertText: party.leader_user_id === user.id ? "Party dissolved" : "Party closed",
        message: {
          text: "The crawler party has been dissolved.",
        },
      };
    }

    await syncPartyStatus(party.id);

    return {
      alertText: "You left the party",
      message: await buildPartyLobbyMessage((await getPartyById(party.id)) ?? party, user.id),
    };
  }

  if (callbackData.startsWith("crawler:party:start:")) {
    const partyId = callbackData.slice("crawler:party:start:".length);
    const party = await getPartyById(partyId);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    if (party.leader_user_id !== user.id) {
      return {
        alertText: "Only the party leader can start the run",
      };
    }

    if (party.status === "in_run" && party.active_run_id) {
      return {
        alertText: "Run already started",
        message: await buildRunMessage(party.active_run_id),
      };
    }

    const members = activeMembers(await listPartyMemberDetails(party.id));
    const readyCount = members.filter((member) => member.status === "ready").length;

    if (!canStartCrawlerParty({ memberCount: members.length, readyMemberCount: readyCount })) {
      return {
        alertText: "Everyone must be ready first",
        message: await buildPartyLobbyMessage(party, user.id),
      };
    }

    const rulesVersion = await ensureRulesVersion({
      versionKey: "arena-v1-alpha",
      summary: "Default crawler-compatible rules anchor.",
      config: {
        mode: "crawler",
        generationVersion: "crawler-v1-prototype",
      },
    });

    const seed = randomUUID();
    const generated = generateRun(seed);
    const run = await createAdventureRun({
      partyId: party.id,
      seed,
      generationVersion: generated.generationVersion,
      floorCount: generated.floorCount,
      difficultyTier: 1,
      themeKey: generated.theme.key,
      rulesVersionId: rulesVersion.id,
      status: "active",
    });

    const rooms = await persistGeneratedRun(run.id, generated);
    const firstRoom = rooms[0]!;

    await activateRoom(run, firstRoom);
    await updateParty({
      partyId: party.id,
      status: "in_run",
      activeRunId: run.id,
    });

    await createAuditLog({
      actorType: "user",
      actorUserId: user.id,
      action: "crawler_run_started",
      targetType: "adventure_run",
      targetId: run.id,
      metadata: {
        partyId: party.id,
        memberCount: members.length,
        themeKey: generated.theme.key,
        floorCount: generated.floorCount,
      },
    });

    return {
      alertText: "Run started",
      message: await buildRunMessage(run.id),
    };
  }

  if (callbackData.startsWith("crawler:run:proceed:")) {
    const roomId = callbackData.slice("crawler:run:proceed:".length);

    if (!roomId) {
      return {
        alertText: "That room action is invalid",
      };
    }

    const currentRoom = await getRunRoomDetailById(roomId);

    if (!currentRoom) {
      return {
        alertText: "Room not found",
      };
    }

    const run = await getAdventureRunById(currentRoom.run_id);

    if (!run) {
      return {
        alertText: "Run not found",
      };
    }

    const party = await getPartyById(run.party_id);

    if (!party) {
      return {
        alertText: "Party not found",
      };
    }

    const membership = await getPartyMemberByPartyAndUser(party.id, user.id);

    if (!membership || !ACTIVE_PARTY_MEMBER_STATUSES.has(membership.status)) {
      return {
        alertText: "You are not an active member of this party",
      };
    }

    if (run.current_room_id !== roomId) {
      return {
        alertText: "That room is no longer active",
      };
    }

    await createRunChoice({
      runId: run.id,
      roomId: currentRoom.id,
      actorUserId: user.id,
      choiceKey: "proceed",
      choicePayload: {
        roomType: currentRoom.room_type,
      },
    });

    await updateRunRoom({
      roomId: currentRoom.id,
      status: "completed",
      resolved: true,
    });

    const rooms = await listRunRoomDetails(run.id);
    const next = nextRoom(rooms, currentRoom.id);
    const memberCount = activeMembers(await listPartyMemberDetails(party.id)).length;

    if (!next) {
      await updateAdventureRun({
        runId: run.id,
        status: "completed",
        currentRoomId: currentRoom.id,
        currentFloorNumber: currentRoom.floor_number,
      });
      await updateParty({
        partyId: party.id,
        status: "completed",
        activeRunId: null,
      });

      return {
        alertText: "Run complete",
        message: formatRunCompleteMessage((await getAdventureRunById(run.id)) ?? run, currentRoom, memberCount),
      };
    }

    await activateRoom(run, next);

    return {
      alertText: `${currentRoom.room_type.replaceAll("_", " ")} resolved`,
      message: formatActiveRoomPrompt((await getAdventureRunById(run.id)) ?? run, next, memberCount),
    };
  }

  return {
    alertText: "Unknown crawler action",
  };
}

export async function handlePartyCallback(
  actor: TelegramActor,
  callbackData: string,
) {
  return handleCrawlerCallback(actor, callbackData);
}

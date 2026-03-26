import { randomUUID } from "node:crypto";

import {
  addPartyMember,
  createAdventureRun,
  createAuditLog,
  createParty,
  ensureRulesVersion,
  getActivePartyForUser,
  getEligibleCharacterByUserId,
  getPartyById,
  getPartyMemberByPartyAndUser,
  getUserById,
  listPartyMemberDetails,
  setPartyMemberStatus,
  setPartyMemberLeft,
  setPartyMemberReadyState,
  updateParty,
  upsertTelegramUser,
  type PartyMemberDetailRecord,
  type PartyRecord,
} from "@dm-bot/db";
import { selectThemeFromSeed } from "@dm-bot/crawler-generation";

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

async function buildPartyLobbyMessage(party: PartyRecord, viewerUserId: string): Promise<CrawlerOutboundMessage> {
  const [members, leader] = await Promise.all([
    listPartyMemberDetails(party.id),
    getUserById(party.leader_user_id),
  ]);

  return formatPartyLobby(party, members, viewerUserId, leader?.display_name ?? "Unknown leader");
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

export async function handlePartyCallback(
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
        message: await buildPartyLobbyMessage(existingParty, user.id),
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
        message: await buildPartyLobbyMessage(existingParty, user.id),
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
        message: {
          text: `This party is already in a run.\n\nActive run: ${party.active_run_id}`,
        },
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
    const theme = selectThemeFromSeed(seed);
    const run = await createAdventureRun({
      partyId: party.id,
      seed,
      generationVersion: "crawler-v1-prototype",
      floorCount: 1,
      difficultyTier: 1,
      themeKey: theme.key,
      rulesVersionId: rulesVersion.id,
      status: "active",
    });

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
        themeKey: theme.key,
      },
    });

    return {
      alertText: "Run started",
      message: {
        text: [
          "The crawler run has begun.",
          "",
          `Run ID: ${run.id}`,
          `Theme: ${theme.name}`,
          `Seed: ${seed}`,
          `Party size: ${members.length}`,
          "",
          "This is the Phase C2 stub run bootstrap. Real room generation arrives in Phase C3.",
        ].join("\n"),
      },
    };
  }

  return {
    alertText: "Unknown crawler action",
  };
}

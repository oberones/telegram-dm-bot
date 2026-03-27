export type EncounterSide = "player" | "monster";

export type EncounterParticipant = {
  id: string;
  name: string;
  side: EncounterSide;
  monsterRole?: "minion" | "brute" | "skirmisher" | "caster" | "support" | "elite" | "boss";
  initiativeModifier: number;
  armorClass: number;
  hitPoints: number;
  maxHitPoints: number;
  attackModifier: number;
  damageDiceCount: number;
  damageDieSides: number;
  damageModifier: number;
};

export type EncounterSnapshot = {
  participants: EncounterParticipant[];
};

export type EncounterEvent =
  | {
      type: "initiative";
      participantId: string;
      roll: number;
      modifier: number;
      total: number;
      summary: string;
    }
  | {
      type: "turn_start";
      round: number;
      participantId: string;
      summary: string;
    }
  | {
      type: "attack";
      round: number;
      participantId: string;
      targetId: string;
      attackRoll: number;
      attackModifier: number;
      total: number;
      targetArmorClass: number;
      isHit: boolean;
      summary: string;
    }
  | {
      type: "damage";
      round: number;
      participantId: string;
      targetId: string;
      rolls: number[];
      modifier: number;
      total: number;
      targetHpBefore: number;
      targetHpAfter: number;
      summary: string;
    }
  | {
      type: "retreat";
      round: number;
      succeeded: boolean;
      summary: string;
    }
  | {
      type: "encounter_end";
      winningSide: EncounterSide;
      roundsCompleted: number;
      summary: string;
    };

export type EncounterResultParticipant = {
  id: string;
  name: string;
  side: EncounterSide;
  maxHitPoints: number;
  currentHitPoints: number;
  damageDealt: number;
  isDefeated: boolean;
};

export type EncounterResolutionResult = {
  winningSide: EncounterSide;
  roundsCompleted: number;
  events: EncounterEvent[];
  finalParticipants: EncounterResultParticipant[];
};

export type RandomSource = {
  rollDie: (sides: number) => number;
};

export type ResolveEncounterInput = {
  participants: EncounterParticipant[];
  rng?: RandomSource;
  roundLimit?: number;
};

export type EncounterStateParticipant = EncounterParticipant & {
  currentHitPoints: number;
  damageDealt: number;
};

export type EncounterState = {
  participants: EncounterStateParticipant[];
  order: string[];
  initiativeRolls: Record<string, number>;
  nextRound: number;
  roundLimit: number;
};

export type EncounterStateInitialization = {
  state: EncounterState;
  events: EncounterEvent[];
};

export type EncounterRoundResult = {
  state: EncounterState;
  events: EncounterEvent[];
  finalParticipants: EncounterResultParticipant[];
  winningSide: EncounterSide | null;
  roundsCompleted: number;
};

export type EncounterRetreatResult = {
  state: EncounterState;
  events: EncounterEvent[];
  finalParticipants: EncounterResultParticipant[];
  succeeded: boolean;
  winningSide: EncounterSide | null;
};

type MutableEncounterParticipant = EncounterStateParticipant;

const defaultRandomSource: RandomSource = {
  rollDie: (sides) => Math.floor(Math.random() * sides) + 1,
};

export function sortParticipantsByInitiative(
  snapshot: EncounterSnapshot,
  rolls: Record<string, number>,
): EncounterParticipant[] {
  return [...snapshot.participants].sort((left, right) => {
    const leftScore = (rolls[left.id] ?? 0) + left.initiativeModifier;
    const rightScore = (rolls[right.id] ?? 0) + right.initiativeModifier;

    if (leftScore !== rightScore) {
      return rightScore - leftScore;
    }

    return left.name.localeCompare(right.name);
  });
}

export function isEncounterResolved(snapshot: EncounterSnapshot): boolean {
  const livingSides = new Set(
    snapshot.participants.filter((participant) => participant.hitPoints > 0).map((participant) => participant.side),
  );

  return livingSides.size <= 1;
}

export function initializeEncounterState(input: ResolveEncounterInput): EncounterStateInitialization {
  const rng = input.rng ?? defaultRandomSource;
  const participants = input.participants.map((participant) => ({
    ...participant,
    currentHitPoints: participant.hitPoints,
    damageDealt: 0,
  }));
  const events: EncounterEvent[] = [];
  const initiativeRolls = Object.fromEntries(
    participants.map((participant) => [participant.id, rng.rollDie(20)]),
  );
  const order = sortParticipantsByInitiative(
    {
      participants: participants.map((participant) => ({
        ...participant,
        hitPoints: participant.currentHitPoints,
      })),
    },
    initiativeRolls,
  ).map((participant) => participant.id);

  for (const participant of participants) {
    const roll = initiativeRolls[participant.id] ?? 0;
    const total = roll + participant.initiativeModifier;
    events.push({
      type: "initiative",
      participantId: participant.id,
      roll,
      modifier: participant.initiativeModifier,
      total,
      summary: `${participant.name} rolls initiative: d20=${roll} + ${participant.initiativeModifier} = ${total}.`,
    });
  }

  return {
    state: {
      participants,
      order,
      initiativeRolls,
      nextRound: 1,
      roundLimit: input.roundLimit ?? 12,
    },
    events,
  };
}

export function resolveEncounterRound(
  state: EncounterState,
  rng: RandomSource = defaultRandomSource,
): EncounterRoundResult {
  const participants = cloneStateParticipants(state.participants);
  const round = state.nextRound;
  const events: EncounterEvent[] = [];

  for (const participantId of state.order) {
    const actor = participants.find((participant) => participant.id === participantId);

    if (!actor || actor.currentHitPoints <= 0) {
      continue;
    }

    const target = chooseTarget(participants, actor, rng);

    if (!target) {
      return {
        state: {
          ...state,
          participants,
        },
        events,
        finalParticipants: participants.map(toResultParticipant),
        winningSide: actor.side,
        roundsCompleted: round - 1,
      };
    }

    events.push({
      type: "turn_start",
      round,
      participantId: actor.id,
      summary: `Round ${round}: ${actor.name} acts.`,
    });

    performAttack(participants, actor, target, round, rng, events);

    const winningSide = checkWinningSide(participants);

    if (winningSide) {
      events.push({
        type: "encounter_end",
        winningSide,
        roundsCompleted: round,
        summary: `${winningSide === "player" ? "The party" : "The monsters"} win the encounter.`,
      });

      return {
        state: {
          ...state,
          participants,
          nextRound: round + 1,
        },
        events,
        finalParticipants: participants.map(toResultParticipant),
        winningSide,
        roundsCompleted: round,
      };
    }
  }

  if (round >= state.roundLimit) {
    const winningSide = survivingHitPointLeader(participants);
    events.push({
      type: "encounter_end",
      winningSide,
      roundsCompleted: round,
      summary: `${winningSide === "player" ? "The party" : "The monsters"} win after a prolonged battle.`,
    });

    return {
      state: {
        ...state,
        participants,
        nextRound: round + 1,
      },
      events,
      finalParticipants: participants.map(toResultParticipant),
      winningSide,
      roundsCompleted: round,
    };
  }

  return {
    state: {
      ...state,
      participants,
      nextRound: round + 1,
    },
    events,
    finalParticipants: participants.map(toResultParticipant),
    winningSide: null,
    roundsCompleted: round,
  };
}

export function resolveRetreatAttempt(
  state: EncounterState,
  rng: RandomSource = defaultRandomSource,
): EncounterRetreatResult {
  const participants = cloneStateParticipants(state.participants);
  const round = state.nextRound;
  const events: EncounterEvent[] = [];
  const livingPlayers = participants.filter((participant) => participant.side === "player" && participant.currentHitPoints > 0);
  const livingMonsters = participants.filter((participant) => participant.side === "monster" && participant.currentHitPoints > 0);

  for (const monster of livingMonsters) {
    const target = chooseTarget(participants, monster, rng);

    if (!target) {
      break;
    }

    performAttack(
      participants,
      monster,
      target,
      round,
      rng,
      events,
      `${monster.name} lashes out with an opportunity attack at ${target.name}.`,
    );
  }

  const survivingPlayers = participants.filter((participant) => participant.side === "player" && participant.currentHitPoints > 0);
  const success = livingPlayers.length > 0 && survivingPlayers.length > 0;
  events.push({
    type: "retreat",
    round,
    succeeded: success,
    summary: success
      ? "The party breaks engagement and falls back to the previous room."
      : "The party is cut down while trying to retreat.",
  });

  return {
    state: {
      ...state,
      participants,
    },
    events,
    finalParticipants: participants.map(toResultParticipant),
    succeeded: success,
    winningSide: success ? null : "monster",
  };
}

export function resolveEncounter(input: ResolveEncounterInput): EncounterResolutionResult {
  const rng = input.rng ?? defaultRandomSource;
  const initialized = initializeEncounterState(input);
  const events = [...initialized.events];
  let state = initialized.state;

  while (true) {
    const roundResult = resolveEncounterRound(state, rng);
    events.push(...roundResult.events);
    state = roundResult.state;

    if (roundResult.winningSide) {
      return {
        winningSide: roundResult.winningSide,
        roundsCompleted: roundResult.roundsCompleted,
        events,
        finalParticipants: roundResult.finalParticipants,
      };
    }

    if (state.nextRound > state.roundLimit) {
      const winningSide = survivingHitPointLeader(state.participants);
      return {
        winningSide,
        roundsCompleted: state.roundLimit,
        events,
        finalParticipants: state.participants.map(toResultParticipant),
      };
    }
  }
}

export function createDeterministicRandomSource(rolls: number[]): RandomSource {
  const queue = [...rolls];

  return {
    rollDie(sides: number) {
      const next = queue.shift();

      if (next === undefined) {
        return 1;
      }

      const normalized = ((next - 1) % sides + sides) % sides;
      return normalized + 1;
    },
  };
}

function cloneStateParticipants(participants: EncounterStateParticipant[]): MutableEncounterParticipant[] {
  return participants.map((participant) => ({ ...participant }));
}

function chooseTarget(
  participants: MutableEncounterParticipant[],
  actor: MutableEncounterParticipant,
  rng: RandomSource = defaultRandomSource,
): MutableEncounterParticipant | undefined {
  const availableTargets = participants.filter(
    (participant) => participant.side !== actor.side && participant.currentHitPoints > 0,
  );

  if (availableTargets.length === 0) {
    return undefined;
  }

  if (actor.side === "monster") {
    const highestPriorityScore = Math.max(...availableTargets.map((participant) => monsterTargetPriorityScore(actor, participant)));
    const highestPriorityTargets = availableTargets.filter(
      (participant) => monsterTargetPriorityScore(actor, participant) === highestPriorityScore,
    );

    if (highestPriorityTargets.length === 1) {
      return highestPriorityTargets[0];
    }

    const targetIndex = rng.rollDie(highestPriorityTargets.length) - 1;
    return highestPriorityTargets[targetIndex];
  }

  const lowestHitPoints = Math.min(...availableTargets.map((participant) => participant.currentHitPoints));
  const lowestHitPointTargets = availableTargets.filter((participant) => participant.currentHitPoints === lowestHitPoints);

  if (lowestHitPointTargets.length === 1) {
    return lowestHitPointTargets[0];
  }

  const targetIndex = rng.rollDie(lowestHitPointTargets.length) - 1;
  return lowestHitPointTargets[targetIndex];
}

function monsterTargetPriorityScore(
  actor: MutableEncounterParticipant,
  target: MutableEncounterParticipant,
): number {
  const expectedActorDamage = actor.damageDiceCount * ((actor.damageDieSides + 1) / 2) + actor.damageModifier;
  const targetThreat = target.attackModifier * 10
    + target.damageModifier * 4
    + target.damageDiceCount * (target.damageDieSides + 1)
    + target.initiativeModifier;
  const finishBonus = target.currentHitPoints <= expectedActorDamage ? 1000 : 0;
  const woundedScore = Math.max(0, target.maxHitPoints - target.currentHitPoints);
  const fragilityScore = Math.max(0, 20 - target.armorClass) * 6 + Math.max(0, 18 - target.maxHitPoints) * 4;

  switch (actor.monsterRole) {
    case "skirmisher":
      return finishBonus + fragilityScore * 5 + targetThreat * 2 + woundedScore;
    case "caster":
      return finishBonus + fragilityScore * 4 + targetThreat * 3 + woundedScore;
    case "support":
      return finishBonus + fragilityScore * 3 + targetThreat * 2 + woundedScore * 2;
    case "brute":
      return finishBonus * 2 + woundedScore * 12 + Math.max(0, 30 - target.currentHitPoints) * 8 + targetThreat;
    case "elite":
    case "boss":
      return finishBonus * 2 + targetThreat * 3 + fragilityScore * 2 + woundedScore * 4;
    case "minion":
    default:
      return finishBonus + targetThreat - target.currentHitPoints;
  }
}

function performAttack(
  participants: MutableEncounterParticipant[],
  actor: MutableEncounterParticipant,
  target: MutableEncounterParticipant,
  round: number,
  rng: RandomSource,
  events: EncounterEvent[],
  openingSummary?: string,
) {
  if (openingSummary) {
    events.push({
      type: "turn_start",
      round,
      participantId: actor.id,
      summary: openingSummary,
    });
  }

  const attackRoll = rng.rollDie(20);
  const total = attackRoll + actor.attackModifier;
  const isHit = total >= target.armorClass;

  events.push({
    type: "attack",
    round,
    participantId: actor.id,
    targetId: target.id,
    attackRoll,
    attackModifier: actor.attackModifier,
    total,
    targetArmorClass: target.armorClass,
    isHit,
    summary: `${actor.name} attacks ${target.name}: d20=${attackRoll} + ${actor.attackModifier} = ${total} vs AC ${target.armorClass}${isHit ? " hit" : " miss"}.`,
  });

  if (!isHit) {
    return;
  }

  const rolls = Array.from({ length: actor.damageDiceCount }, () => rng.rollDie(actor.damageDieSides));
  const totalDamage = rolls.reduce((sum, value) => sum + value, 0) + actor.damageModifier;
  const before = target.currentHitPoints;
  target.currentHitPoints = Math.max(0, target.currentHitPoints - totalDamage);
  actor.damageDealt += totalDamage;

  events.push({
    type: "damage",
    round,
    participantId: actor.id,
    targetId: target.id,
    rolls,
    modifier: actor.damageModifier,
    total: totalDamage,
    targetHpBefore: before,
    targetHpAfter: target.currentHitPoints,
    summary: `${actor.name} deals ${totalDamage} damage to ${target.name} (${before} -> ${target.currentHitPoints}).`,
  });
}

function checkWinningSide(participants: MutableEncounterParticipant[]): EncounterSide | null {
  const livingSides = new Set(
    participants.filter((participant) => participant.currentHitPoints > 0).map((participant) => participant.side),
  );

  if (livingSides.size === 1) {
    return [...livingSides][0]!;
  }

  return null;
}

function survivingHitPointLeader(participants: MutableEncounterParticipant[]): EncounterSide {
  const totals = participants.reduce<Record<EncounterSide, number>>(
    (accumulator, participant) => {
      accumulator[participant.side] += participant.currentHitPoints;
      return accumulator;
    },
    { player: 0, monster: 0 },
  );

  return totals.player >= totals.monster ? "player" : "monster";
}

function toResultParticipant(participant: MutableEncounterParticipant): EncounterResultParticipant {
  return {
    id: participant.id,
    name: participant.name,
    side: participant.side,
    maxHitPoints: participant.maxHitPoints,
    currentHitPoints: participant.currentHitPoints,
    damageDealt: participant.damageDealt,
    isDefeated: participant.currentHitPoints <= 0,
  };
}

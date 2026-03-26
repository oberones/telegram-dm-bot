export type EncounterSide = "player" | "monster";

export type EncounterParticipant = {
  id: string;
  name: string;
  side: EncounterSide;
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

type MutableEncounterParticipant = EncounterParticipant & {
  currentHitPoints: number;
  damageDealt: number;
};

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

export function resolveEncounter(input: ResolveEncounterInput): EncounterResolutionResult {
  const rng = input.rng ?? defaultRandomSource;
  const roundLimit = input.roundLimit ?? 12;
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

  for (let round = 1; round <= roundLimit; round += 1) {
    for (const participantId of order) {
      const actor = participants.find((participant) => participant.id === participantId);

      if (!actor || actor.currentHitPoints <= 0) {
        continue;
      }

      const target = chooseTarget(participants, actor.side);

      if (!target) {
        const winningSide = actor.side;
        events.push({
          type: "encounter_end",
          winningSide,
          roundsCompleted: round - 1,
          summary: `${winningSide === "player" ? "The party" : "The monsters"} win the encounter.`,
        });

        return {
          winningSide,
          roundsCompleted: round - 1,
          events,
          finalParticipants: participants.map(toResultParticipant),
        };
      }

      events.push({
        type: "turn_start",
        round,
        participantId: actor.id,
        summary: `Round ${round}: ${actor.name} acts.`,
      });

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
        continue;
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

      const winningSide = checkWinningSide(participants);

      if (winningSide) {
        events.push({
          type: "encounter_end",
          winningSide,
          roundsCompleted: round,
          summary: `${winningSide === "player" ? "The party" : "The monsters"} win the encounter.`,
        });

        return {
          winningSide,
          roundsCompleted: round,
          events,
          finalParticipants: participants.map(toResultParticipant),
        };
      }
    }
  }

  const winningSide = survivingHitPointLeader(participants);
  events.push({
    type: "encounter_end",
    winningSide,
    roundsCompleted: roundLimit,
    summary: `${winningSide === "player" ? "The party" : "The monsters"} win after a prolonged battle.`,
  });

  return {
    winningSide,
    roundsCompleted: roundLimit,
    events,
    finalParticipants: participants.map(toResultParticipant),
  };
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

function chooseTarget(
  participants: MutableEncounterParticipant[],
  actingSide: EncounterSide,
): MutableEncounterParticipant | undefined {
  return participants
    .filter((participant) => participant.side !== actingSide && participant.currentHitPoints > 0)
    .sort((left, right) => {
      if (left.currentHitPoints !== right.currentHitPoints) {
        return left.currentHitPoints - right.currentHitPoints;
      }

      return left.name.localeCompare(right.name);
    })[0];
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

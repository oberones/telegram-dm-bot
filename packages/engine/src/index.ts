export type CombatClass = "fighter" | "rogue" | "wizard" | "cleric";
export type MatchEndReason =
  | "knockout"
  | "round_limit_hp_pct"
  | "round_limit_damage"
  | "round_limit_hits"
  | "sudden_death";

export type AbilityScores = {
  str: number;
  dex: number;
  con: number;
  int: number;
  wis: number;
  cha: number;
};

export type DerivedStats = {
  maxHp: number;
  armorClass: number;
  initiativeMod: number;
  proficiencyBonus: number;
  speed: number;
  saveMods: Record<string, number>;
};

export type CombatLoadout = {
  actions: string[];
  weapons?: string[];
  spells?: string[];
};

export type CombatResources = {
  secondWindAvailable?: boolean;
  spellSlots?: Record<string, number>;
};

export type CombatParticipant = {
  slot: 1 | 2;
  name: string;
  classKey: CombatClass;
  level: number;
  abilityScores: AbilityScores;
  derivedStats: DerivedStats;
  loadout: CombatLoadout;
  resourceState: CombatResources;
};

export type CombatEvent =
  | {
      type: "initiative";
      participantSlot: 1 | 2;
      roll: number;
      modifier: number;
      total: number;
      summary: string;
    }
  | {
      type: "turn_start";
      round: number;
      participantSlot: 1 | 2;
      summary: string;
    }
  | {
      type: "action";
      round: number;
      participantSlot: 1 | 2;
      actionKey: string;
      summary: string;
    }
  | {
      type: "attack";
      round: number;
      participantSlot: 1 | 2;
      targetSlot: 1 | 2;
      actionKey: string;
      attackRoll: number;
      attackModifier: number;
      total: number;
      targetArmorClass: number;
      isHit: boolean;
      isCritical: boolean;
      summary: string;
    }
  | {
      type: "save";
      round: number;
      participantSlot: 1 | 2;
      targetSlot: 1 | 2;
      actionKey: string;
      saveType: string;
      difficultyClass: number;
      roll: number;
      modifier: number;
      total: number;
      isSuccess: boolean;
      summary: string;
    }
  | {
      type: "damage";
      round: number;
      participantSlot: 1 | 2;
      targetSlot: 1 | 2;
      actionKey: string;
      rolls: number[];
      modifier: number;
      total: number;
      targetHpBefore: number;
      targetHpAfter: number;
      summary: string;
    }
  | {
      type: "heal";
      round: number;
      participantSlot: 1 | 2;
      actionKey: string;
      rolls: number[];
      modifier: number;
      total: number;
      hpBefore: number;
      hpAfter: number;
      summary: string;
    }
  | {
      type: "match_end";
      winnerParticipantSlot: 1 | 2;
      endReason: MatchEndReason;
      summary: string;
    };

export type MatchParticipantState = {
  slot: 1 | 2;
  name: string;
  classKey: CombatClass;
  maxHp: number;
  currentHp: number;
  armorClass: number;
  damageDealt: number;
  successfulHits: number;
  resources: CombatResources;
};

export type MatchResolutionResult = {
  winnerParticipantSlot: 1 | 2;
  endReason: MatchEndReason;
  roundsCompleted: number;
  events: CombatEvent[];
  finalStates: MatchParticipantState[];
};

export type RandomSource = {
  rollDie: (sides: number) => number;
};

export type ResolveMatchInput = {
  participants: [CombatParticipant, CombatParticipant];
  rng?: RandomSource;
  roundLimit?: number;
};

const defaultRandomSource: RandomSource = {
  rollDie: (sides) => Math.floor(Math.random() * sides) + 1,
};

type MutableState = MatchParticipantState & {
  participant: CombatParticipant;
};

type AttackProfile = {
  actionKey: string;
  attackModifier: number;
  damageDice: { count: number; sides: number };
  damageModifier: number;
  save?: {
    type: "dex";
    dc: number;
  };
  autoHit?: boolean;
};

export function resolveMatch(input: ResolveMatchInput): MatchResolutionResult {
  const rng = input.rng ?? defaultRandomSource;
  const roundLimit = input.roundLimit ?? 10;
  const states = input.participants.map((participant) => createState(participant)) as [
    MutableState,
    MutableState,
  ];
  const events: CombatEvent[] = [];
  const initiativeOrder = rollInitiative(states, rng, events);
  let roundsCompleted = 0;

  for (let round = 1; round <= roundLimit; round += 1) {
    roundsCompleted = round;

    for (const actorSlot of initiativeOrder) {
      const actor = states.find((state) => state.slot === actorSlot)!;
      const target = states.find((state) => state.slot !== actorSlot)!;

      if (actor.currentHp <= 0 || target.currentHp <= 0) {
        continue;
      }

      events.push({
        type: "turn_start",
        round,
        participantSlot: actor.slot,
        summary: `Round ${round}: ${actor.name} begins their turn.`,
      });

      const action = chooseAction(actor, target);
      events.push({
        type: "action",
        round,
        participantSlot: actor.slot,
        actionKey: action.actionKey,
        summary: `${actor.name} uses ${action.actionKey}.`,
      });

      if (action.actionKey === "Second Wind") {
        resolveSecondWind(actor, round, rng, events);
      } else if (action.save) {
        resolveSavingThrowAction(actor, target, action, round, rng, events);
      } else {
        resolveAttackAction(actor, target, action, round, rng, events);
      }

      if (target.currentHp <= 0) {
        const result = buildKnockoutResult(actor.slot, roundsCompleted, states, events);
        return result;
      }
    }
  }

  return buildTiebreakResult(roundsCompleted, states, events);
}

export function createDeterministicRandomSource(rolls: number[]): RandomSource {
  const queue = [...rolls];

  return {
    rollDie(sides: number) {
      const next = queue.shift();

      if (next === undefined) {
        throw new Error(`Deterministic random source ran out of rolls for d${sides}`);
      }

      if (next < 1 || next > sides) {
        throw new Error(`Deterministic roll ${next} is invalid for d${sides}`);
      }

      return next;
    },
  };
}

function createState(participant: CombatParticipant): MutableState {
  return {
    slot: participant.slot,
    name: participant.name,
    classKey: participant.classKey,
    maxHp: participant.derivedStats.maxHp,
    currentHp: participant.derivedStats.maxHp,
    armorClass: participant.derivedStats.armorClass,
    damageDealt: 0,
    successfulHits: 0,
    resources: structuredClone(participant.resourceState),
    participant,
  };
}

function rollInitiative(states: MutableState[], rng: RandomSource, events: CombatEvent[]) {
  const rolled = states.map((state) => {
    const roll = rng.rollDie(20);
    const modifier = state.participant.derivedStats.initiativeMod;
    const total = roll + modifier;

    events.push({
      type: "initiative",
      participantSlot: state.slot,
      roll,
      modifier,
      total,
      summary: `${state.name} rolls initiative: d20=${roll} + ${modifier} = ${total}.`,
    });

    return {
      slot: state.slot,
      total,
      dex: state.participant.abilityScores.dex,
      con: state.participant.abilityScores.con,
    };
  });

  rolled.sort((left, right) => {
    if (right.total !== left.total) {
      return right.total - left.total;
    }

    if (right.dex !== left.dex) {
      return right.dex - left.dex;
    }

    if (right.con !== left.con) {
      return right.con - left.con;
    }

    return right.slot - left.slot;
  });

  return rolled.map((entry) => entry.slot) as [1 | 2, 1 | 2];
}

function chooseAction(actor: MutableState, target: MutableState): AttackProfile {
  const participant = actor.participant;
  const proficiency = participant.derivedStats.proficiencyBonus;
  const ability = participant.abilityScores;

  switch (participant.classKey) {
    case "fighter": {
      if (actor.resources.secondWindAvailable && actor.currentHp <= Math.floor(actor.maxHp / 2)) {
        return {
          actionKey: "Second Wind",
          attackModifier: 0,
          damageDice: { count: 0, sides: 0 },
          damageModifier: 0,
        };
      }

      return {
        actionKey: "Longsword Attack",
        attackModifier: abilityModifier(ability.str) + proficiency,
        damageDice: { count: 1, sides: 8 },
        damageModifier: abilityModifier(ability.str),
      };
    }
    case "rogue":
      return {
        actionKey: "Rapier Attack",
        attackModifier: abilityModifier(ability.dex) + proficiency,
        damageDice: { count: 1, sides: 8 },
        damageModifier: abilityModifier(ability.dex) + 3,
      };
    case "wizard": {
      const slots = actor.resources.spellSlots?.level1 ?? 0;

      if (slots > 0) {
        return {
          actionKey: "Magic Missile",
          attackModifier: 0,
          damageDice: { count: 3, sides: 4 },
          damageModifier: 3,
          autoHit: true,
        };
      }

      return {
        actionKey: "Fire Bolt",
        attackModifier: abilityModifier(ability.int) + proficiency,
        damageDice: { count: 1, sides: 10 },
        damageModifier: 0,
      };
    }
    case "cleric": {
      const slots = actor.resources.spellSlots?.level1 ?? 0;

      if (slots > 0) {
        return {
          actionKey: "Guiding Bolt",
          attackModifier: abilityModifier(ability.wis) + proficiency,
          damageDice: { count: 4, sides: 6 },
          damageModifier: 0,
        };
      }

      return {
        actionKey: "Sacred Flame",
        attackModifier: 0,
        damageDice: { count: 1, sides: 8 },
        damageModifier: 0,
        save: {
          type: "dex",
          dc: 8 + proficiency + abilityModifier(ability.wis),
        },
      };
    }
  }

  return {
    actionKey: "Improvised Attack",
    attackModifier: 0,
    damageDice: { count: 1, sides: 4 },
    damageModifier: 0,
  };
}

function resolveSecondWind(
  actor: MutableState,
  round: number,
  rng: RandomSource,
  events: CombatEvent[],
) {
  const roll = rng.rollDie(10);
  const total = roll + actor.participant.level;
  const before = actor.currentHp;
  actor.currentHp = Math.min(actor.maxHp, actor.currentHp + total);
  actor.resources.secondWindAvailable = false;

  events.push({
    type: "heal",
    round,
    participantSlot: actor.slot,
    actionKey: "Second Wind",
    rolls: [roll],
    modifier: actor.participant.level,
    total,
    hpBefore: before,
    hpAfter: actor.currentHp,
    summary: `${actor.name} regains ${total} HP with Second Wind (${before} -> ${actor.currentHp}).`,
  });
}

function resolveSavingThrowAction(
  actor: MutableState,
  target: MutableState,
  action: AttackProfile,
  round: number,
  rng: RandomSource,
  events: CombatEvent[],
) {
  const saveRoll = rng.rollDie(20);
  const modifier = target.participant.derivedStats.saveMods[action.save!.type] ?? 0;
  const total = saveRoll + modifier;
  const isSuccess = total >= action.save!.dc;

  events.push({
    type: "save",
    round,
    participantSlot: actor.slot,
    targetSlot: target.slot,
    actionKey: action.actionKey,
    saveType: action.save!.type,
    difficultyClass: action.save!.dc,
    roll: saveRoll,
    modifier,
    total,
    isSuccess,
    summary: `${target.name} makes a ${action.save!.type.toUpperCase()} save: d20=${saveRoll} + ${modifier} = ${total} vs DC ${action.save!.dc}${isSuccess ? " success" : " fail"}.`,
  });

  if (isSuccess) {
    return;
  }

  const damageRolls = rollDice(rng, action.damageDice.count, action.damageDice.sides);
  applyDamage(actor, target, action, damageRolls, round, events);
}

function resolveAttackAction(
  actor: MutableState,
  target: MutableState,
  action: AttackProfile,
  round: number,
  rng: RandomSource,
  events: CombatEvent[],
) {
  if (action.autoHit) {
    spendResourceIfNeeded(actor, action);
    const damageRolls = rollDice(rng, action.damageDice.count, action.damageDice.sides);

    events.push({
      type: "attack",
      round,
      participantSlot: actor.slot,
      targetSlot: target.slot,
      actionKey: action.actionKey,
      attackRoll: 0,
      attackModifier: 0,
      total: 0,
      targetArmorClass: target.armorClass,
      isHit: true,
      isCritical: false,
      summary: `${actor.name} uses ${action.actionKey}, which hits automatically.`,
    });

    applyDamage(actor, target, action, damageRolls, round, events);
    return;
  }

  const attackRoll = rng.rollDie(20);
  const isCritical = attackRoll === 20;
  const isAutomaticMiss = attackRoll === 1;
  const total = attackRoll + action.attackModifier;
  const isHit = !isAutomaticMiss && (isCritical || total >= target.armorClass);

  events.push({
    type: "attack",
    round,
    participantSlot: actor.slot,
    targetSlot: target.slot,
    actionKey: action.actionKey,
    attackRoll,
    attackModifier: action.attackModifier,
    total,
    targetArmorClass: target.armorClass,
    isHit,
    isCritical,
    summary: `${actor.name} attacks with ${action.actionKey}: d20=${attackRoll} + ${action.attackModifier} = ${total} vs AC ${target.armorClass}${isHit ? " hit" : " miss"}.`,
  });

  if (!isHit) {
    return;
  }

  spendResourceIfNeeded(actor, action);
  const diceCount = isCritical ? action.damageDice.count * 2 : action.damageDice.count;
  const damageRolls = rollDice(rng, diceCount, action.damageDice.sides);
  applyDamage(actor, target, action, damageRolls, round, events);
}

function spendResourceIfNeeded(actor: MutableState, action: AttackProfile) {
  if (action.actionKey === "Magic Missile" || action.actionKey === "Guiding Bolt") {
    const current = actor.resources.spellSlots?.level1 ?? 0;
    actor.resources.spellSlots = {
      ...(actor.resources.spellSlots ?? {}),
      level1: Math.max(0, current - 1),
    };
  }
}

function applyDamage(
  actor: MutableState,
  target: MutableState,
  action: AttackProfile,
  damageRolls: number[],
  round: number,
  events: CombatEvent[],
) {
  const before = target.currentHp;
  const total = Math.max(0, sum(damageRolls) + action.damageModifier);
  target.currentHp = Math.max(0, target.currentHp - total);
  actor.damageDealt += total;
  actor.successfulHits += 1;

  events.push({
    type: "damage",
    round,
    participantSlot: actor.slot,
    targetSlot: target.slot,
    actionKey: action.actionKey,
    rolls: damageRolls,
    modifier: action.damageModifier,
    total,
    targetHpBefore: before,
    targetHpAfter: target.currentHp,
    summary: `${actor.name} deals ${total} damage to ${target.name} with ${action.actionKey} (${before} -> ${target.currentHp}).`,
  });
}

function buildKnockoutResult(
  winnerSlot: 1 | 2,
  roundsCompleted: number,
  states: MutableState[],
  events: CombatEvent[],
): MatchResolutionResult {
  const winner = states.find((state) => state.slot === winnerSlot)!;

  events.push({
    type: "match_end",
    winnerParticipantSlot: winnerSlot,
    endReason: "knockout",
    summary: `${winner.name} wins by knockout.`,
  });

  return {
    winnerParticipantSlot: winnerSlot,
    endReason: "knockout",
    roundsCompleted,
    events,
    finalStates: states.map(stripState),
  };
}

function buildTiebreakResult(
  roundsCompleted: number,
  states: MutableState[],
  events: CombatEvent[],
): MatchResolutionResult {
  const left = states[0]!;
  const right = states[1]!;
  const leftHpPct = left.currentHp / left.maxHp;
  const rightHpPct = right.currentHp / right.maxHp;
  let winner: MutableState;
  let endReason: MatchEndReason;

  if (leftHpPct !== rightHpPct) {
    winner = leftHpPct > rightHpPct ? left : right;
    endReason = "round_limit_hp_pct";
  } else if (left.damageDealt !== right.damageDealt) {
    winner = left.damageDealt > right.damageDealt ? left : right;
    endReason = "round_limit_damage";
  } else if (left.successfulHits !== right.successfulHits) {
    winner = left.successfulHits > right.successfulHits ? left : right;
    endReason = "round_limit_hits";
  } else {
    winner = left.currentHp >= right.currentHp ? left : right;
    endReason = "sudden_death";
  }

  events.push({
    type: "match_end",
    winnerParticipantSlot: winner.slot,
    endReason,
    summary: `${winner.name} wins by ${endReason}.`,
  });

  return {
    winnerParticipantSlot: winner.slot,
    endReason,
    roundsCompleted,
    events,
    finalStates: states.map(stripState),
  };
}

function stripState(state: MutableState): MatchParticipantState {
  return {
    slot: state.slot,
    name: state.name,
    classKey: state.classKey,
    maxHp: state.maxHp,
    currentHp: state.currentHp,
    armorClass: state.armorClass,
    damageDealt: state.damageDealt,
    successfulHits: state.successfulHits,
    resources: state.resources,
  };
}

function rollDice(rng: RandomSource, count: number, sides: number) {
  return Array.from({ length: count }, () => rng.rollDie(sides));
}

function sum(values: number[]) {
  return values.reduce((total, value) => total + value, 0);
}

function abilityModifier(score: number) {
  return Math.floor((score - 10) / 2);
}

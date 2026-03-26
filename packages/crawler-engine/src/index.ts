export type EncounterSide = "player" | "monster";

export type EncounterParticipant = {
  id: string;
  name: string;
  side: EncounterSide;
  initiativeModifier: number;
  armorClass: number;
  hitPoints: number;
  maxHitPoints: number;
};

export type EncounterSnapshot = {
  participants: EncounterParticipant[];
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

export type MatchResolutionResult = {
  winnerParticipantSlot: 1 | 2 | null;
  endReason: "error";
  events: Array<{
    type: string;
    summary: string;
  }>;
};

export function resolveMatchPlaceholder(): MatchResolutionResult {
  return {
    winnerParticipantSlot: null,
    endReason: "error",
    events: [
      {
        type: "not_implemented",
        summary: "Combat engine has not been implemented yet.",
      },
    ],
  };
}

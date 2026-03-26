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

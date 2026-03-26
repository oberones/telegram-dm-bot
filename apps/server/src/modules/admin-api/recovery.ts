import type { AdventureRunRecord, EncounterRecord, MatchRecord, RunRewardRecord } from "@dm-bot/db";

export function explainFlaggedDispute(status: string) {
  if (status === "pending") {
    return "Awaiting target response or administrative cancellation.";
  }

  return "No recovery action suggested.";
}

export function explainFlaggedMatch(params: {
  status: MatchRecord["status"];
  endReason: MatchRecord["end_reason"];
  errorSummary?: string | null;
}) {
  if (params.status === "error") {
    return params.errorSummary?.trim() || "Match entered an error state and needs administrative review.";
  }

  if (params.status === "running") {
    return "Match is still marked running and may require administrative finalization or cancellation.";
  }

  if (params.status === "queued") {
    return "Match is queued but has not completed yet.";
  }

  if (params.status === "cancelled") {
    return "Match was cancelled and no further recovery is expected.";
  }

  if (params.status === "finalized_by_admin") {
    return "Match was finalized by an administrator.";
  }

  if (params.endReason === "error") {
    return "Match ended with an error reason and should be reviewed.";
  }

  return "No recovery action suggested.";
}

export function explainFlaggedCrawlerRun(params: {
  status: AdventureRunRecord["status"];
  currentRoomId?: string | null;
  activeEncounterId?: string | null;
  failureReason?: string | null;
}) {
  if (params.status === "error") {
    return params.failureReason?.trim() || "Run entered an error state and should be failed administratively.";
  }

  if (params.status === "paused") {
    return "Run is paused. Review whether it should stay paused or be failed administratively.";
  }

  if (params.status === "in_combat" || params.activeEncounterId) {
    return "Run appears to be in combat and may need administrative failure if the encounter is stuck.";
  }

  if (params.status === "awaiting_choice" && params.currentRoomId) {
    return "Run is waiting on room input. If players cannot continue, fail the run conservatively.";
  }

  if (params.status === "active" || params.status === "forming") {
    return "Run is still marked active and may require administrative failure if it is stuck.";
  }

  return "No crawler recovery action suggested.";
}

export function explainFlaggedCrawlerEncounter(params: {
  status: EncounterRecord["status"];
  errorSummary?: string | null;
}) {
  if (params.status === "error") {
    return params.errorSummary?.trim() || "Encounter is errored and the parent run should remain paused until reviewed.";
  }

  if (params.status === "active") {
    return "Encounter is still active. If players are stuck, mark it errored to pause the run conservatively.";
  }

  if (params.status === "queued") {
    return "Encounter has not resolved yet and may be stale if the run is no longer progressing.";
  }

  if (params.status === "cancelled") {
    return "Encounter was cancelled during recovery.";
  }

  return "No encounter recovery action suggested.";
}

export function summarizeCrawlerRewards(rewards: RunRewardRecord[]) {
  const granted = rewards.filter((reward) => reward.status === "granted").length;
  const pending = rewards.filter((reward) => reward.status === "pending").length;
  const revoked = rewards.filter((reward) => reward.status === "revoked").length;
  const anomalies: string[] = [];

  if (pending > 0) {
    anomalies.push(`${pending} reward ledger row(s) are still pending.`);
  }

  if (revoked > 0) {
    anomalies.push(`${revoked} reward ledger row(s) were revoked and should be reviewed.`);
  }

  return {
    granted,
    pending,
    revoked,
    anomalies,
  };
}

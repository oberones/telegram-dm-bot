import type { MatchRecord } from "@dm-bot/db";

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

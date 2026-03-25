import { resolveMatchPlaceholder } from "@dm-bot/engine";

export function buildReadinessSnapshot() {
  return {
    database: "pending" as const,
    rulesConfig: "pending" as const,
  };
}

export function acknowledgeTelegramUpdate() {
  return { ok: true as const };
}

export function previewMatchResolution() {
  return resolveMatchPlaceholder();
}

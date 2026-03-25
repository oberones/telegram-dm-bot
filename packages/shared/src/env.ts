export type AppEnv = "local" | "staging" | "production";
export type TelegramDeliveryMode = "webhook" | "polling";

export type AppConfig = {
  nodeEnv: string;
  appEnv: AppEnv;
  port: number;
  appBaseUrl: string;
  adminBaseUrl: string;
  databaseUrl: string;
  telegramBotToken: string;
  telegramWebhookSecret: string;
  telegramWebhookUrl: string;
  sessionSecret: string;
  cookieSecure: boolean;
  logLevel: string;
  defaultRulesVersion: string;
  disableNewDisputes: boolean;
  telegramDeliveryMode: TelegramDeliveryMode;
  telegramPollingTimeoutSeconds: number;
};

function readString(name: string, fallback?: string): string {
  const value = process.env[name] ?? fallback;

  if (!value) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  return value;
}

function readNumber(name: string, fallback?: number): number {
  const raw = process.env[name] ?? (fallback !== undefined ? String(fallback) : undefined);

  if (!raw) {
    throw new Error(`Missing required environment variable: ${name}`);
  }

  const value = Number(raw);

  if (Number.isNaN(value)) {
    throw new Error(`Environment variable ${name} must be a number`);
  }

  return value;
}

function readBoolean(name: string, fallback = false): boolean {
  const raw = process.env[name];

  if (raw === undefined) {
    return fallback;
  }

  return raw === "true";
}

export function loadConfig(): AppConfig {
  return {
    nodeEnv: readString("NODE_ENV", "development"),
    appEnv: readString("APP_ENV", "local") as AppEnv,
    port: readNumber("PORT", 3000),
    appBaseUrl: readString("APP_BASE_URL", "http://localhost:3000"),
    adminBaseUrl: readString("ADMIN_BASE_URL", "http://localhost:5173"),
    databaseUrl: readString(
      "DATABASE_URL",
      "postgres://postgres:postgres@localhost:5432/dungeon_master_bot",
    ),
    telegramBotToken: readString("TELEGRAM_BOT_TOKEN", "replace-me"),
    telegramWebhookSecret: readString("TELEGRAM_WEBHOOK_SECRET", "replace-me"),
    telegramWebhookUrl: readString(
      "TELEGRAM_WEBHOOK_URL",
      "https://example.com/telegram/webhook",
    ),
    sessionSecret: readString("SESSION_SECRET", "replace-me"),
    cookieSecure: readBoolean("COOKIE_SECURE", false),
    logLevel: readString("LOG_LEVEL", "info"),
    defaultRulesVersion: readString("DEFAULT_RULES_VERSION", "arena-v1-alpha"),
    disableNewDisputes: readBoolean("DISABLE_NEW_DISPUTES", false),
    telegramDeliveryMode: readString("TELEGRAM_DELIVERY_MODE", "webhook") as TelegramDeliveryMode,
    telegramPollingTimeoutSeconds: readNumber("TELEGRAM_POLLING_TIMEOUT_SECONDS", 30),
  };
}

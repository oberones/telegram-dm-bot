export type HealthStatus = "ok";

export type HealthResponse = {
  status: HealthStatus;
  service: string;
  timestamp: string;
};

export type ReadyResponse = HealthResponse & {
  checks: {
    database: "pending";
    rulesConfig: "pending";
  };
};

export type TelegramWebhookAck = {
  ok: true;
};

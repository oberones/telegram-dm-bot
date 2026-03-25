export type HealthStatus = "ok";

export type HealthResponse = {
  status: HealthStatus;
  service: string;
  timestamp: string;
};

export type ReadyResponse = HealthResponse & {
  checks: {
    database: "pending" | "ok" | "error";
    rulesConfig: "pending";
  };
};

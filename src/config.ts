import "dotenv/config";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  apiBaseUrl: (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, ""),
  serviceToken: required("SERVICE_TOKEN"),
  miniAppPort: Number(process.env.MINI_APP_PORT ?? "3000"),
  miniAppHost: process.env.MINI_APP_HOST ?? "0.0.0.0",
  miniAppUrl: (process.env.MINI_APP_URL ?? "").replace(/\/+$/, ""),
  webhookBaseUrl: (process.env.WEBHOOK_BASE_URL ?? "").replace(/\/+$/, ""),
  webhookSecret: process.env.WEBHOOK_SECRET ?? "",
};

export const API_PREFIX = "/api/v1/participant";

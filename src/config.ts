import "dotenv/config";
import path from "path";

function required(name: string): string {
  const value = process.env[name];
  if (!value) {
    throw new Error(`Missing required env variable: ${name}`);
  }
  return value;
}

export const config = {
  botToken: required("BOT_TOKEN"),
  adminTgId: Number(process.env.ADMIN_TG_ID ?? "0"),
  apiBaseUrl: (process.env.API_BASE_URL ?? "http://localhost:4000").replace(/\/+$/, ""),
  serviceToken: process.env.SERVICE_TOKEN ?? "",
  backendMode: (process.env.BACKEND_MODE ?? (process.env.SERVICE_TOKEN ? "remote" : "local")) as "remote" | "local",
  dataDir: path.resolve(process.env.DATA_DIR ?? "./data"),
  miniAppPort: Number(process.env.MINI_APP_PORT ?? "3000"),
  miniAppHost: process.env.MINI_APP_HOST ?? "0.0.0.0",
  miniAppUrl: (process.env.MINI_APP_URL ?? "").replace(/\/+$/, ""),
};

export const API_PREFIX = "/api/v1/participant";

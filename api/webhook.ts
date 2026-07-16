import type { IncomingMessage, ServerResponse } from "http";
import { webhookCallback } from "grammy";
import { createBot } from "../src/bot";
import { config } from "../src/config";

const bot = createBot();
const initialize = bot.init();
const handle = webhookCallback(bot, "http", { timeoutMilliseconds: 9_000 });

export default async function webhook(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") { response.statusCode = 405; return response.end("Method Not Allowed"); }
  if (config.webhookSecret && request.headers["x-telegram-bot-api-secret-token"] !== config.webhookSecret) { response.statusCode = 401; return response.end("Unauthorized"); }
  await initialize;
  return handle(request, response);
}

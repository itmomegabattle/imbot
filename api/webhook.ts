import type { IncomingMessage, ServerResponse } from "http";
import { webhookCallback } from "grammy";
import { createBot } from "../src/bot";
import { config } from "../src/config";
import { logger } from "../src/logger";

const bot = createBot();
const initialize = bot.init();
const handle = webhookCallback(bot, "http", { timeoutMilliseconds: 9_000 });

export default async function webhook(request: IncomingMessage, response: ServerResponse) {
  if (request.method !== "POST") { response.statusCode = 405; return response.end("Method Not Allowed"); }
  if (config.webhookSecret && request.headers["x-telegram-bot-api-secret-token"] !== config.webhookSecret) { response.statusCode = 401; return response.end("Unauthorized"); }
  try {
    await initialize;
    return await handle(request, response);
  } catch (error) {
    const message = error instanceof Error ? error.message : "Unknown webhook error";
    logger.error(`Webhook update failed: ${message}`);
    // A failed update must be acknowledged or Telegram will retry it forever
    // and starve all newer commands in the bot queue.
    if (!response.headersSent) {
      response.statusCode = 200;
      response.end("OK");
    }
    return undefined;
  }
}

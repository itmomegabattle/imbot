import { Bot } from "grammy";
import { api } from "../api/client";
import { config } from "../config";
import { TelegramMessagesResponse } from "../api/types";
import { logger } from "../logger";

const POLL_INTERVAL_MS = 3000;
const ERROR_BACKOFF_MS = 5000;
const MAX_MESSAGES_PER_SECOND = 30;

/**
 * Раз в несколько секунд опрашивает GET /messages/telegram (сообщения, которые
 * backend поставил в очередь — например, уведомления о новостях/апдейтах сезона
 * из мейлинга) и рассылает их пользователям, укладываясь в лимит Telegram
 * (~30 сообщений в секунду). Аналог message_sender.py.
 */
export function startMessageForwarder(bot: Bot): void {
  void loop(bot);
}

async function loop(bot: Bot) {
  for (;;) {
    try {
      const res = await api.call<TelegramMessagesResponse>("messages/telegram", {
        token: config.serviceToken,
      });
      for (const message of res.messages) {
        await sendWithRateLimit(bot, message.user_id, message.text);
      }
    } catch (err) {
      logger.error("messageForwarder: failed to poll/send messages", err);
      await sleep(ERROR_BACKOFF_MS);
      continue;
    }
    await sleep(POLL_INTERVAL_MS);
  }
}

let sentInCurrentSecond = 0;
let windowStart = Date.now();

async function sendWithRateLimit(bot: Bot, chatId: number, text: string) {
  const now = Date.now();
  if (now - windowStart >= 1000) {
    windowStart = now;
    sentInCurrentSecond = 0;
  }
  if (sentInCurrentSecond >= MAX_MESSAGES_PER_SECOND) {
    await sleep(1000 - (now - windowStart));
    windowStart = Date.now();
    sentInCurrentSecond = 0;
  }
  sentInCurrentSecond++;
  try {
    await bot.api.sendMessage(chatId, text);
  } catch (err) {
    logger.error(`messageForwarder: failed to deliver message to ${chatId}`, err);
  }
}

function sleep(ms: number) {
  return new Promise((resolve) => setTimeout(resolve, Math.max(0, ms)));
}

import { Bot, GrammyError, HttpError } from "grammy";
import { config } from "../config";
import { SigmaContext } from "./context";
import { accessControl } from "./middleware/accessControl";
import { registerStartCommands } from "./commands/start";
import { registerProfileCommands } from "./commands/profile";
import { registerCurrencyCommands } from "./commands/currency";
import { registerEventCommands } from "./commands/events";
import { registerFreshmanCommands } from "./commands/freshmanInfo";
import { registerAdminCommands } from "./commands/admin";
import { registerCodeHandler } from "./commands/codes";
import { logger } from "../logger";

export function createBot(): Bot<SigmaContext> {
  const bot = new Bot<SigmaContext>(config.botToken);

  // Telegram retries an update until the webhook answers successfully. One
  // broken command must not block every command queued behind it.
  bot.use(async (ctx, next) => {
    try {
      await next();
    } catch (error) {
      const message = error instanceof Error ? error.message : "Unknown bot error";
      logger.error(`Update ${ctx.update.update_id} failed: ${message}`);
      await ctx.reply("Не удалось выполнить действие. Попробуй ещё раз; если ошибка повторится — напиши организатору.").catch(() => undefined);
    }
  });

  bot.use(accessControl);

  registerStartCommands(bot);
  registerProfileCommands(bot);
  registerCurrencyCommands(bot);
  registerEventCommands(bot);
  registerFreshmanCommands(bot);
  registerAdminCommands(bot);

  // Обработчик "голого" текста (применение кодов) — самый широкий, регистрируем последним.
  registerCodeHandler(bot);

  bot.catch((err) => {
    const ctx = err.ctx;
    const message = err.error instanceof Error ? err.error.message : "Unknown bot error";
    logger.error(`Unhandled update ${ctx.update.update_id}: ${message}`);
    const e = err.error;
    if (e instanceof GrammyError) {
      logger.error(`Telegram API error: ${e.description}`);
    } else if (e instanceof HttpError) {
      logger.error("Could not reach Telegram");
    }
    void ctx.reply("Не удалось выполнить действие. Попробуй ещё раз; если ошибка повторится — напиши организатору.").catch(() => undefined);
  });

  return bot;
}

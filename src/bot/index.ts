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
    logger.error(`Unhandled error while processing update ${ctx.update.update_id}:`, err.error);
    const e = err.error;
    if (e instanceof GrammyError) {
      logger.error("Telegram API error:", e.description);
    } else if (e instanceof HttpError) {
      logger.error("Could not reach Telegram:", e);
    }
  });

  return bot;
}

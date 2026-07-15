import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { AccessLevel } from "../../api/types";
import { codeManager, CodeError } from "../../state/codeManager";
import { logger } from "../../logger";

const CODE_RE = /^\d{6}$/;

/**
 * Ловит "голые" текстовые сообщения (не команды). Если это похоже на 6-значный
 * код — пробует применить его (перевод валюты / ачивка / отметка на меро).
 * Регистрировать эту команду нужно ПОСЛЕДНЕЙ — она самый широкий обработчик,
 * как и UseCodeWithoutCommand в оригинальном bot.py.
 */
export function registerCodeHandler(bot: Bot<SigmaContext>) {
  bot.on("message:text", async (ctx) => {
    if (ctx.accessLevel < AccessLevel.USER) {
      await ctx.reply("Сначала нужно зарегистрироваться — отправьте /start.");
      return;
    }
    const text = ctx.message.text.trim();
    if (!CODE_RE.test(text)) {
      await ctx.reply("Не понимаю эту команду. Отправьте /help, чтобы увидеть список доступных команд.");
      return;
    }
    try {
      const resultText = await codeManager.use(text, ctx.from!.id);
      await ctx.reply(resultText);
    } catch (err) {
      if (err instanceof CodeError) {
        await ctx.reply(err.message);
      } else {
        logger.error("codes: unexpected error applying code", err);
        await ctx.reply("Возникла ошибка, попробуйте ещё раз.");
      }
    }
  });
}

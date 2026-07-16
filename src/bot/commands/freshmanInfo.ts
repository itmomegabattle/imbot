import { Bot, InlineKeyboard } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { backend } from "../../services/backend";
import { escapeHtml } from "../utils/format";

export function registerFreshmanCommands(bot: Bot<SigmaContext>) {
  bot.command("freshman", requireAccess(AccessLevel.USER), async (ctx) => {
    const sections = await backend.info();
    const keyboard = new InlineKeyboard();
    for (const section of sections) keyboard.text(section.title, `info:${section.key}`).row();
    await ctx.reply("Информационная справка:", { reply_markup: keyboard });
  });
  bot.callbackQuery(/^info:(.+)$/, async (ctx) => {
    const sections = await backend.info(); const section = sections.find((item) => item.key === ctx.match![1]);
    await ctx.answerCallbackQuery(); if (section) await ctx.reply(`<b>${escapeHtml(section.title)}</b>\n\n${escapeHtml(section.body)}`, { parse_mode: "HTML" });
  });
  bot.command("set_info", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [key, title, ...body] = ctx.match.toString().split("|").map((value) => value.trim());
    if (!key || !title || !body.join("|").trim()) return void (await ctx.reply("Использование: /set_info ключ | Заголовок | Текст"));
    await backend.setInfo(ctx.from!.id, key, { title, body: body.join(" | ") });
    await ctx.reply("Раздел справки обновлён.");
  });
}

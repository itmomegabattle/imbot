import { Bot, InlineKeyboard } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { CONTENT_SECTIONS, contentStore } from "../../state/contentStore";

export function registerFreshmanCommands(bot: Bot<SigmaContext>) {
  bot.command("freshman", requireAccess(AccessLevel.USER), async (ctx) => {
    const keyboard = new InlineKeyboard();
    for (const [key, section] of Object.entries(CONTENT_SECTIONS)) {
      keyboard.text(section.title, `info:${key}`).row();
    }
    await ctx.reply("Справка для перваков — выбери раздел:", { reply_markup: keyboard });
  });

  bot.callbackQuery(/^info:(.+)$/, async (ctx) => {
    const key = ctx.match![1];
    const section = CONTENT_SECTIONS[key];
    if (!section) {
      await ctx.answerCallbackQuery();
      return;
    }
    await ctx.answerCallbackQuery();
    await ctx.reply(`*${section.title}*\n\n${contentStore.get(key)}`, { parse_mode: "Markdown" });
  });

  // /set_info <ключ_раздела> <текст> — организаторы редактируют содержимое справки.
  bot.command("set_info", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const text = ctx.match?.toString() ?? "";
    const spaceIdx = text.indexOf(" ");
    if (spaceIdx === -1) {
      const keys = Object.keys(CONTENT_SECTIONS)
        .map((k) => `\`${k}\` — ${CONTENT_SECTIONS[k].title}`)
        .join("\n");
      await ctx.reply(`Использование: /set_info <ключ> <текст>\n\nДоступные ключи:\n${keys}`, { parse_mode: "Markdown" });
      return;
    }
    const key = text.slice(0, spaceIdx).trim();
    const newText = text.slice(spaceIdx + 1).trim();
    if (!CONTENT_SECTIONS[key]) {
      await ctx.reply(`Неизвестный ключ раздела: ${key}`);
      return;
    }
    contentStore.set(key, newText);
    await ctx.reply(`Раздел «${CONTENT_SECTIONS[key].title}» обновлён.`);
  });
}

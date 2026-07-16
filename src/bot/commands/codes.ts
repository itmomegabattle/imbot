import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { AccessLevel } from "../../api/types";
import { backend } from "../../services/backend";

export function registerCodeHandler(bot: Bot<SigmaContext>) {
  bot.on("message:text", async (ctx) => {
    if (ctx.accessLevel < AccessLevel.USER) return void (await ctx.reply("Сначала отправь /start."));
    const code = ctx.message.text.trim();
    if (!/^[A-Za-z0-9_-]{3,100}$/.test(code)) return void (await ctx.reply("Не понимаю сообщение. Список команд — /help."));
    try {
      const result = await backend.redeem(ctx.from!.id, code);
      await ctx.reply(`Код применён: ${result.label}${result.xp ? `, +${result.xp} XP` : ""}${result.currencyAmount ? `, +${result.currencyAmount} валюты` : ""}`);
    } catch (error: any) { await ctx.reply(`Код не применён: ${error.response?.data?.error ?? "неверный или уже использован"}`); }
  });
}

import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { backend } from "../../services/backend";

export function registerCurrencyCommands(bot: Bot<SigmaContext>) {
  bot.command("balance", requireAccess(AccessLevel.USER), async (ctx) => {
    const dashboard = await backend.dashboard(ctx.from!.id);
    const lines = dashboard.currencies.map((item) => `${item.name}: <b>${item.amount}</b>`).join("\n") || "Баланс пока пуст";
    await ctx.reply(`💙 <b>Баланс</b>\n${lines}\n\nОбщий баланс факультета: <b>${dashboard.facultyBalance ?? 0}</b>`, { parse_mode: "HTML" });
  });

  bot.command("transfer", requireAccess(AccessLevel.USER), async (ctx) => {
    const parts = ctx.match.toString().trim().split(/\s+/);
    const rawAmount = parts.pop();
    const nickname = parts.join(" ");
    const amount = Number(rawAmount);
    if (!nickname || !Number.isInteger(amount) || amount < 10) return void (await ctx.reply("Использование: /transfer <никнейм> <сумма>\nМинимум — 10, только целые числа."));
    try {
      const recipient = await backend.publicProfile(nickname.replace(/^@/, ""));
      const result = await backend.transfer(ctx.from!.id, recipient.id, amount, `telegram-update:${ctx.update.update_id}:transfer`);
      await ctx.reply(`Переведено ${result.amount ?? amount} валюты пользователю ${recipient.nickname}.`);
    } catch (error: any) {
      await ctx.reply(`Перевод не выполнен: ${error.response?.data?.error ?? "проверь никнейм и баланс"}`);
    }
  });
}

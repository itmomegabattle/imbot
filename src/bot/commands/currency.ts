import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { formatCurrencies } from "../utils/format";
import { codeManager } from "../../state/codeManager";
import { appStore } from "../../state/appStore";
import { backend, usesRemoteBackend } from "../../services/backend";

export function registerCurrencyCommands(bot: Bot<SigmaContext>) {
  bot.command("balance", requireAccess(AccessLevel.USER), async (ctx) => {
    if (usesRemoteBackend) {
      const dashboard = await backend.dashboard(ctx.from!.id);
      const history = dashboard.currencyHistory.slice(0, 5);
      const historyText = history.length
        ? `\n\n*Последние операции:*\n${history.map((event) => `${event.amount > 0 ? "+" : ""}${event.amount} — ${event.reason}`).join("\n")}`
        : "";
      await ctx.reply(`*Ваш баланс:*\n${formatCurrencies(dashboard.currencies)}${historyText}`, { parse_mode: "Markdown" });
      return;
    }
    const history = appStore.currencyHistory(ctx.from!.id).slice(0, 5);
    const historyText = history.length
      ? `\n\n*Последние операции:*\n${history.map((e) => `${e.amount > 0 ? "+" : ""}${e.amount} — ${e.reason}`).join("\n")}`
      : "";
    await ctx.reply(`*Ваш баланс:*\n${formatCurrencies(appStore.userCurrencies(ctx.from!.id))}${historyText}`, { parse_mode: "Markdown" });
  });

  bot.command("give_currency", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/).filter(Boolean) ?? [];
    if (args.length < 2) {
      await ctx.reply("Использование: /give_currency <название валюты> <сумма>\nНапример: /give_currency Кредиты 50");
      return;
    }
    const amount = Number(args[args.length - 1]);
    const currencyQuery = args.slice(0, -1).join(" ").toLowerCase();

    if (!Number.isFinite(amount) || amount <= 0) {
      await ctx.reply("Сумма должна быть положительным числом.");
      return;
    }

    const match = appStore.currencies().find((c) => c.name.toLowerCase().includes(currencyQuery));
    if (!match) {
      await ctx.reply(`Валюта «${currencyQuery}» не найдена. Доступные: ${appStore.currencies().map((c) => c.name).join(", ")}`);
      return;
    }
    const code = codeManager.emitTransferCode(match.id, String(amount));
    await ctx.reply(
      `Код на +${amount} ${match.name} сгенерирован:\n\`${code}\`\n\nОтправьте его получателю или зашейте в NFC-метку. Код одноразовый, действителен 90 дней.`,
      { parse_mode: "Markdown" },
    );
  });
}

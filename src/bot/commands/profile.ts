import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { getCurrentSeason } from "../../services/seasons";
import { formatAchievements } from "../utils/format";
import { appStore } from "../../state/appStore";
import { backend, usesRemoteBackend } from "../../services/backend";

export function registerProfileCommands(bot: Bot<SigmaContext>) {
  bot.command("me", requireAccess(AccessLevel.USER), async (ctx) => {
    if (usesRemoteBackend) {
      const dashboard = await backend.dashboard(ctx.from!.id);
      const text =
        `*${dashboard.user.name}*\n` +
        `Telegram ID: \`${dashboard.user.tgId}\`\n` +
        (dashboard.user.username ? `Username: @${dashboard.user.username}\n` : "") +
        `Роль: ${dashboard.user.isManager ? "организатор" : "участник"}\n\n` +
        `*Уровень ${dashboard.level.level}: ${dashboard.level.title}*\n` +
        `XP: ${dashboard.level.xp}${dashboard.level.nextMinXp ? ` / ${dashboard.level.nextMinXp}` : ""}\n` +
        (dashboard.level.nextLevel ? `До уровня ${dashboard.level.nextLevel}: ${dashboard.level.xpToNext} XP` : "Максимальный уровень сезона");
      await ctx.reply(text, { parse_mode: "Markdown" });
      return;
    }
    const me = appStore.getUser(ctx.from!.id);
    if (!me) {
      await ctx.reply("Профиль не найден. Отправьте /start.");
      return;
    }
    const season = await getCurrentSeason();
    const achievements = appStore.userAchievements(ctx.from!.id);
    const level = appStore.levelProgress(ctx.from!.id);
    const history = appStore.scoreHistory(ctx.from!.id).slice(0, 5);
    const text =
      `*${me.firstName} ${me.lastName}*\n` +
      `Telegram ID: \`${me.tgId}\`\n` +
      (me.username ? `Username: @${me.username}\n` : "") +
      `Роль: ${me.isManager ? "организатор" : "участник"}\n` +
      `\n*Уровень ${level.level}: ${level.title}*\n` +
      `XP: ${level.xp}${level.nextMinXp ? ` / ${level.nextMinXp}` : ""}\n` +
      (level.nextLevel ? `До уровня ${level.nextLevel}: ${level.xpToNext} XP\n` : "Максимальный уровень сезона\n") +
      (season ? `\n*Уровень / достижения (сезон «${season.title}»):*\n${formatAchievements(achievements)}` : "");

    await ctx.reply(text, { parse_mode: "Markdown" });
    if (history.length > 0) {
      await ctx.reply(`*Последние начисления XP:*\n${history.map((e) => `+${e.amount} — ${e.reason}`).join("\n")}`, {
        parse_mode: "Markdown",
      });
    }
  });

  bot.command("top", requireAccess(AccessLevel.USER), async (ctx) => {
    if (usesRemoteBackend) {
      const top = await backend.leaderboard(20);
      if (!top.length) return void (await ctx.reply("Таблица лидеров пока пуста."));
      await ctx.reply(
        `*Топ сезона:*\n${top.map((entry) => `${entry.place}. ${entry.full_name || entry.nickname} — ${entry.xp} XP`).join("\n")}`,
        { parse_mode: "Markdown" },
      );
      return;
    }
    const season = await getCurrentSeason();
    const top = appStore.leaderboard().slice(0, 20);
    if (top.length === 0) {
      await ctx.reply("Таблица лидеров пока пуста.");
      return;
    }
    const lines = top.map(({ user, points }, i) => `${i + 1}. ${user.firstName} ${user.lastName} — ${points} очков`);
    await ctx.reply(`*Топ сезона${season ? ` «${season.title}»` : ""}:*\n${lines.join("\n")}`, { parse_mode: "Markdown" });
  });
}

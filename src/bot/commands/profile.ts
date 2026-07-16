import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { backend } from "../../services/backend";
import { escapeHtml } from "../utils/format";

const FACULTIES = ["КТУ", "ТИНТ", "НОЖ", "ФТМФ", "ФТМИ"];

export function registerProfileCommands(bot: Bot<SigmaContext>) {
  bot.command("setup", requireAccess(AccessLevel.USER), async (ctx) => {
    const [nicknameRaw, facultyRaw] = ctx.match.toString().split("|").map((value) => value.trim());
    const faculty = FACULTIES.find((item) => item.toLowerCase() === facultyRaw?.toLowerCase());
    if (!nicknameRaw || nicknameRaw.length < 2 || !faculty) return void (await ctx.reply(`Заполни профиль так:\n/setup Имя или никнейм | КТУ\n\nФакультет: ${FACULTIES.join(", ")}`));
    await backend.updateProfile(ctx.from!.id, { nickname: nicknameRaw, faculty });
    await ctx.reply("Профиль заполнен. Теперь доступны все функции экосистемы.");
  });

  bot.command("isu", requireAccess(AccessLevel.USER), async (ctx) => {
    const isu = ctx.match.toString().trim();
    if (isu && !/^\d{4,12}$/.test(isu)) return void (await ctx.reply("Использование: /isu 123456\nПоле необязательное; при ITMO.ID оно заполнится автоматически."));
    await backend.updateProfile(ctx.from!.id, { isu_number: isu || null });
    await ctx.reply(isu ? "Номер ИСУ сохранён." : "Номер ИСУ удалён из профиля.");
  });

  bot.command("me", requireAccess(AccessLevel.USER), async (ctx) => {
    const d = await backend.dashboard(ctx.from!.id);
    const achievements = d.achievements?.map((item) => `• ${escapeHtml(item.name)}${item.amount > 1 ? ` ×${item.amount}` : ""}`).join("\n") || "пока нет";
    await ctx.reply(`<b>${escapeHtml(d.user.name)}</b>${d.user.faculty ? ` · ${escapeHtml(d.user.faculty)}` : ""}\n${d.user.onboardingCompleted ? "Профиль заполнен" : "Заполни профиль: /setup"}\n\n<b>Уровень ${d.level.level}: ${escapeHtml(d.level.title)}</b>\n${d.level.xp} XP · до следующего ${d.level.xpToNext}\n\n<b>Достижения</b>\n${achievements}`, { parse_mode: "HTML" });
  });

  bot.command("top", requireAccess(AccessLevel.USER), async (ctx) => {
    const top = await backend.leaderboard(20);
    if (!top.length) return void (await ctx.reply("Таблица лидеров пока пуста."));
    await ctx.reply(`<b>Топ сезона</b>\n${top.map((entry) => `${entry.place}. ${escapeHtml(entry.nickname)} — ${entry.xp} XP`).join("\n")}`, { parse_mode: "HTML" });
  });
}

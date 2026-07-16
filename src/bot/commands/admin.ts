import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { backend } from "../../services/backend";

async function findUser(adminId: number, query: string) {
  const result = await backend.adminProfiles(adminId, query, 10);
  if (!result.items?.length) throw new Error("Пользователь не найден");
  const exact = result.items.find((item: any) => item.nickname?.toLowerCase() === query.replace(/^@/, "").toLowerCase() || item.isu_number === query || item.telegram_username?.toLowerCase() === query.replace(/^@/, "").toLowerCase());
  return exact ?? result.items[0];
}

export function registerAdminCommands(bot: Bot<SigmaContext>) {
  bot.command("news", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const text = ctx.match.toString().trim();
    if (!text) return void (await ctx.reply("Использование: /news текст рассылки\nМожно отправить команду подписью к фотографии."));
    const mediaFileId = ctx.message?.photo?.at(-1)?.file_id;
    const result = await backend.broadcast(ctx.from!.id, text, mediaFileId, `telegram-update:${ctx.update.update_id}:broadcast`);
    await ctx.reply(`Рассылка поставлена в очередь: ${result.total_count} получателей.`);
  });

  bot.command("stats", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const s = await backend.adminStats(ctx.from!.id);
    const faculties = s.faculties.map((item: any) => `${item.faculty}: ${item.balance}`).join("\n");
    await ctx.reply(`<b>${s.season.title}</b>\nУчастников: ${s.users}\nРегистраций: ${s.registrations}\nПосещений: ${s.attendances}\nНачислено валюты: ${s.issuedCurrency}\n\n${faculties}`, { parse_mode: "HTML" });
  });

  bot.command("give", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [userQuery, typeRaw, amountRaw, ...reasonParts] = ctx.match.toString().trim().split(/\s+/);
    const type = typeRaw?.toLowerCase() === "xp" ? "xp" : typeRaw?.toLowerCase() === "currency" || typeRaw?.toLowerCase() === "валюта" ? "currency" : null;
    const amount = Number(amountRaw); const reason = reasonParts.join(" ") || "Ручное начисление";
    if (!userQuery || !type || !Number.isInteger(amount) || amount === 0) return void (await ctx.reply("Использование: /give <ник/ИСУ> <xp|currency> <сумма> <причина>"));
    try { const user = await findUser(ctx.from!.id, userQuery); await backend.adminTransaction(ctx.from!.id, user.id, type, amount, reason, `telegram-update:${ctx.update.update_id}:transaction`); await ctx.reply(`Готово: ${user.nickname}, ${amount > 0 ? "+" : ""}${amount} ${type}.`); }
    catch (error: any) { await ctx.reply(error.response?.data?.error ?? error.message); }
  });

  bot.command("achievement", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [userQuery, code, amountRaw] = ctx.match.toString().trim().split(/\s+/); const amount = Number(amountRaw ?? 1);
    if (!userQuery || !code || !Number.isInteger(amount) || amount < 1) return void (await ctx.reply("Использование: /achievement <ник/ИСУ> <код_ачивки> [количество]"));
    try { const user = await findUser(ctx.from!.id, userQuery); await backend.grantAchievement(ctx.from!.id, user.id, code, amount, `telegram-update:${ctx.update.update_id}:achievement`); await ctx.reply(`Ачивка выдана: ${user.nickname}.`); }
    catch (error: any) { await ctx.reply(error.response?.data?.error ?? error.message); }
  });

  bot.command("achievements", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const result = await backend.achievements(ctx.from!.id); await ctx.reply(result.achievements.length ? result.achievements.map((item: any) => `<code>${item.code}</code> — ${item.name}`).join("\n") : "Ачивок пока нет.", { parse_mode: "HTML" });
  });

  bot.command("achievement_save", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [code, name, description = ""] = ctx.match.toString().split("|").map((value) => value.trim());
    if (!code || !name) return void (await ctx.reply("Использование: /achievement_save код | Название | Описание"));
    try {
      const result = await backend.saveAchievement(ctx.from!.id, { code, name, description: description || null });
      await ctx.reply(`Ачивка «${result.name}» сохранена.`);
    } catch (error: any) { await ctx.reply(error.response?.data?.error ?? error.message); }
  });

  bot.command("reward_code", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [code, typeRaw, amountRaw, ...labelParts] = ctx.match.toString().trim().split(/\s+/); const amount = Number(amountRaw); const label = labelParts.join(" ") || "Награда";
    if (!code || !["xp", "currency"].includes(typeRaw) || !Number.isInteger(amount) || amount < 1) return void (await ctx.reply("Использование: /reward_code КОД <xp|currency> <сумма> <название>"));
    await backend.createRewardCode(ctx.from!.id, { code, label, xpAmount: typeRaw === "xp" ? amount : 0, currencyCode: typeRaw === "currency" ? "credits" : undefined, currencyAmount: typeRaw === "currency" ? amount : undefined });
    await ctx.reply(`Код <code>${code}</code> создан.`, { parse_mode: "HTML" });
  });

  bot.command("add_admin", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const query = ctx.match.toString().trim(); if (!query) return void (await ctx.reply("Использование: /add_admin <ник/ИСУ>"));
    const user = await findUser(ctx.from!.id, query); await backend.setAdmin(ctx.from!.id, user.id, true); await ctx.reply(`${user.nickname} назначен администратором.`);
  });
  bot.command("remove_admin", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const query = ctx.match.toString().trim(); if (!query) return void (await ctx.reply("Использование: /remove_admin <ник/ИСУ>"));
    const user = await findUser(ctx.from!.id, query); await backend.setAdmin(ctx.from!.id, user.id, false); await ctx.reply(`Роль администратора снята с ${user.nickname}.`);
  });

  bot.command("event_create", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [name, startsAt, mode = "external_itmo_events", minRaw, maxRaw] = ctx.match.toString().split("|").map((v) => v.trim());
    if (!name || !startsAt || Number.isNaN(Date.parse(startsAt))) return void (await ctx.reply("Использование: /event_create Название | 2026-09-01T18:00:00+03:00 | internal_team | 3 | 7"));
    const slug = `${name.toLowerCase().replace(/[^a-zа-я0-9]+/gi, "-").replace(/^-|-$/g, "")}-${ctx.update.update_id}`;
    const team = mode === "internal_team";
    const row = await backend.createEvent(ctx.from!.id, { slug, group_key: "megabattle", status: "published", name, starts_at: startsAt, registration_status: "open", registration_mode: mode, min_team_size: team ? Number(minRaw || 3) : null, max_team_size: team ? Number(maxRaw || 7) : null });
    await ctx.reply(`Мероприятие создано. ID: <code>${row.id}</code>`, { parse_mode: "HTML" });
  });

  bot.command("season_start", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const [title, slugRaw, endsAtRaw] = ctx.match.toString().split("|").map((value) => value.trim());
    if (!title) return void (await ctx.reply("Использование: /season_start Название | season-slug | 2027-07-01T00:00:00+03:00"));
    const startsAt = new Date(); const endsAt = endsAtRaw ? new Date(endsAtRaw) : new Date(startsAt.getTime() + 365 * 24 * 3600_000);
    if (Number.isNaN(endsAt.getTime())) return void (await ctx.reply("Неверная дата окончания сезона."));
    const slug = slugRaw || `season-${startsAt.getFullYear()}`;
    const season = await backend.startSeason(ctx.from!.id, { title, slug, startsAt: startsAt.toISOString(), endsAt: endsAt.toISOString() });
    await ctx.reply(`Сезон «${season.title}» активирован. XP и валюта начинаются с нуля; ачивки сохранены.`);
  });
}

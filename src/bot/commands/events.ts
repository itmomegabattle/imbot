import { Bot, InlineKeyboard } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { backend } from "../../services/backend";
import { escapeHtml } from "../utils/format";

export function registerEventCommands(bot: Bot<SigmaContext>) {
  bot.command("events", requireAccess(AccessLevel.USER), async (ctx) => {
    const events = await backend.events();
    if (!events.length) return void (await ctx.reply("Ближайших мероприятий пока нет."));
    for (const event of events.slice(0, 15)) {
      const id = event.id;
      const title = event.name ?? event.title ?? "Мероприятие";
      const date = event.starts_at ? new Date(event.starts_at).toLocaleString("ru-RU", { timeZone: "Europe/Moscow" }) : "дата уточняется";
      const mode = event.registration_mode ?? "external_itmo_events";
      const keyboard = new InlineKeyboard();
      if (event.registration_status === "open" && mode === "internal_individual") keyboard.text("Зарегистрироваться", `event_reg:${id}`).text("Отменить", `event_unreg:${id}`);
      if (event.registration_status === "open" && mode === "internal_team") keyboard.text("Командная регистрация", `event_team_help:${id}`);
      if (event.registration_status === "open" && mode === "external_itmo_events" && event.registration_link) keyboard.url("Регистрация в ITMO Events", event.registration_link);
      await ctx.reply(`<b>${escapeHtml(title)}</b>\n${escapeHtml(event.description)}\n\n${escapeHtml(date)}${event.location ? `\n${escapeHtml(event.location)}` : ""}`, { parse_mode: "HTML", reply_markup: keyboard.inline_keyboard.length ? keyboard : undefined });
    }
  });

  bot.callbackQuery(/^event_reg:(.+)$/, requireAccess(AccessLevel.USER), async (ctx) => { await backend.registerEvent(ctx.from!.id, ctx.match![1]); await ctx.answerCallbackQuery({ text: "Вы зарегистрированы" }); });
  bot.callbackQuery(/^event_unreg:(.+)$/, requireAccess(AccessLevel.USER), async (ctx) => { await backend.unregisterEvent(ctx.from!.id, ctx.match![1]); await ctx.answerCallbackQuery({ text: "Регистрация отменена" }); });
  bot.callbackQuery(/^event_team_help:(.+)$/, async (ctx) => { await ctx.answerCallbackQuery(); await ctx.reply(`Создать команду:\n/team_create ${ctx.match![1]} | Название\n\nВступить по коду:\n/team_join КОД`); });

  bot.command("team_create", requireAccess(AccessLevel.USER), async (ctx) => {
    const [eventId, name] = ctx.match.toString().split("|").map((value) => value.trim());
    if (!eventId || !name) return void (await ctx.reply("Использование: /team_create <event_id> | Название команды"));
    const result = await backend.createTeam(ctx.from!.id, eventId, name);
    await ctx.reply(`Команда «${escapeHtml(name)}» создана.\nКод для сокомандников: <code>${escapeHtml(result.joinCode)}</code>\nОн действует до закрытия регистрации.`, { parse_mode: "HTML" });
  });
  bot.command("team_join", requireAccess(AccessLevel.USER), async (ctx) => {
    const code = ctx.match.toString().trim(); if (!code) return void (await ctx.reply("Использование: /team_join КОД"));
    const result = await backend.joinTeam(ctx.from!.id, code); await ctx.reply(`Ты в команде «${result.teamName}».`);
  });
  bot.command("team", requireAccess(AccessLevel.USER), async (ctx) => {
    const eventId = ctx.match.toString().trim(); if (!eventId) return void (await ctx.reply("Использование: /team <event_id>"));
    const { team } = await backend.getTeam(ctx.from!.id, eventId); if (!team) return void (await ctx.reply("На этом мероприятии ты пока не в команде."));
    const members = team.event_team_members?.map((member: any) => member.profiles?.nickname ?? member.profile_id).join(", ") ?? "";
    await ctx.reply(`<b>${escapeHtml(team.name)}</b> · ${escapeHtml(team.status)}\n${escapeHtml(members)}${team.join_code_hint ? `\nКод: <code>${escapeHtml(team.join_code_hint)}</code>` : ""}\nID: <code>${escapeHtml(team.id)}</code>`, { parse_mode: "HTML" });
  });
  bot.command("team_complete", requireAccess(AccessLevel.USER), async (ctx) => { const id = ctx.match.toString().trim(); if (!id) return void (await ctx.reply("Использование: /team_complete <team_id>")); await backend.teamAction(ctx.from!.id, id, { action: "complete" }); await ctx.reply("Команда зарегистрирована."); });
  bot.command("team_rotate", requireAccess(AccessLevel.USER), async (ctx) => { const id = ctx.match.toString().trim(); if (!id) return void (await ctx.reply("Использование: /team_rotate <team_id>")); const result = await backend.teamAction(ctx.from!.id, id, { action: "rotate_code" }); await ctx.reply(`Новый код: <code>${result.joinCode}</code>`, { parse_mode: "HTML" }); });
}

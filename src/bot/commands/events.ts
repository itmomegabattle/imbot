import { Bot, InlineKeyboard } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { getCurrentSeason } from "../../services/seasons";
import { formatEvent } from "../utils/format";
import { appStore } from "../../state/appStore";
import { backend, usesRemoteBackend } from "../../services/backend";

export function registerEventCommands(bot: Bot<SigmaContext>) {
  bot.command("events", requireAccess(AccessLevel.USER), async (ctx) => {
    if (usesRemoteBackend) {
      const events = await backend.events();
      if (!events.length) return void (await ctx.reply("Ближайших мероприятий пока нет."));
      for (const event of events.slice(0, 15)) {
        const date = event.starts_at ? new Date(event.starts_at).toLocaleString("ru-RU") : "дата уточняется";
        const keyboard = event.registration_status === "open"
          ? new InlineKeyboard().text("Зарегистрироваться", `event_reg:${event.id}`).text("Отменить регистрацию", `event_unreg:${event.id}`)
          : undefined;
        await ctx.reply(`*${event.name}*\n${event.description ?? ""}\n\n${date}${event.location ? `\n${event.location}` : ""}`, {
          parse_mode: "Markdown",
          reply_markup: keyboard,
        });
      }
      return;
    }
    const season = await getCurrentSeason();
    if (!season) {
      await ctx.reply("Активный сезон не найден.");
      return;
    }

    const upcoming = appStore
      .eventsForCurrentSeason()
      .filter((e) => new Date(e.date_end).getTime() >= Date.now())
      .sort((a, b) => new Date(a.date_begin).getTime() - new Date(b.date_begin).getTime());

    if (upcoming.length === 0) {
      await ctx.reply("Ближайших мероприятий пока нет.");
      return;
    }

    for (const event of upcoming.slice(0, 15)) {
      const keyboard = event.registration_required
        ? new InlineKeyboard()
            .text("Зарегистрироваться", `event_reg:${event.id}`)
            .text("Отменить регистрацию", `event_unreg:${event.id}`)
        : undefined;
      await ctx.reply(formatEvent(event), { parse_mode: "Markdown", reply_markup: keyboard });
    }
  });

  bot.callbackQuery(/^event_reg:(.+)$/, requireAccess(AccessLevel.USER), async (ctx) => {
    if (usesRemoteBackend) {
      await backend.registerEvent(ctx.from!.id, ctx.match![1]);
      await ctx.answerCallbackQuery({ text: "Вы зарегистрированы" });
      return;
    }
    const result = appStore.registerEvent(ctx.from!.id, ctx.match![1]);
    await ctx.answerCallbackQuery({
      text: result === "ok" ? "Вы зарегистрированы" : result === "duplicate" ? "Вы уже зарегистрированы" : "Мероприятие не найдено",
      show_alert: result !== "ok",
    });
  });

  bot.callbackQuery(/^event_unreg:(.+)$/, requireAccess(AccessLevel.USER), async (ctx) => {
    if (usesRemoteBackend) {
      await backend.unregisterEvent(ctx.from!.id, ctx.match![1]);
      await ctx.answerCallbackQuery({ text: "Регистрация отменена" });
      return;
    }
    const result = appStore.unregisterEvent(ctx.from!.id, ctx.match![1]);
    await ctx.answerCallbackQuery({ text: result === "ok" ? "Регистрация отменена" : "Мероприятие не найдено" });
  });
}

import { Bot } from "grammy";
import { SigmaContext } from "../context";
import { requireAccess } from "../middleware/accessControl";
import { AccessLevel } from "../../api/types";
import { getCurrentSeason } from "../../services/seasons";
import { codeManager } from "../../state/codeManager";
import { appStore } from "../../state/appStore";
import { logger } from "../../logger";

const pendingBroadcast = new Set<number>();

export function registerAdminCommands(bot: Bot<SigmaContext>) {
  bot.command("news", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    pendingBroadcast.add(ctx.from!.id);
    await ctx.reply("Пришлите следующим сообщением текст новости (можно с фото/файлом). Чтобы отменить — /cancel.");
  });

  bot.command("cancel", async (ctx) => {
    if (pendingBroadcast.delete(ctx.from!.id)) {
      await ctx.reply("Рассылка отменена.");
    }
  });

  bot.on("message", async (ctx, next) => {
    const adminId = ctx.from?.id;
    if (!adminId || !pendingBroadcast.has(adminId)) return next();
    pendingBroadcast.delete(adminId);

    const users = appStore.users();
    let sent = 0;
    for (const user of users) {
      try {
        await ctx.copyMessage(user.tgId);
        sent++;
      } catch (err) {
        logger.debug(`news: failed to deliver to ${user.tgId}: ${err}`);
      }
    }
    await ctx.reply(`Готово, разослано ${sent} из ${users.length} пользователей.`);
  });

  bot.command("give_achievement", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const args = ctx.match?.toString().trim().split(/\s+/).filter(Boolean) ?? [];
    if (args.length < 2) {
      await ctx.reply("Использование: /give_achievement <часть названия ачивки> <кол-во>");
      return;
    }
    const amount = Number(args[args.length - 1]);
    const query = args.slice(0, -1).join(" ").toLowerCase();
    if (!Number.isInteger(amount) || amount <= 0) {
      await ctx.reply("Количество должно быть положительным целым числом.");
      return;
    }
    const match = appStore.achievements().find((a) => a.name.toLowerCase().includes(query));
    if (!match) {
      await ctx.reply(`Ачивка «${query}» не найдена. Доступные: ${appStore.achievements().map((a) => a.name).join(", ")}`);
      return;
    }
    const code = codeManager.emitAchievementCode(match.id, amount);
    await ctx.reply(`Код на ачивку «${match.name}» x${amount}:\n\`${code}\`\n\nОдноразовый, действителен 90 дней.`, {
      parse_mode: "Markdown",
    });
  });

  bot.command("attendance_code", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const eventId = ctx.match?.toString().trim();
    if (!eventId) {
      const events = appStore.eventsForCurrentSeason().map((e) => `\`${e.id}\` — ${e.title}`).join("\n");
      await ctx.reply(`Использование: /attendance_code <event_id>\n\nДоступные мероприятия:\n${events || "пока нет"}`, {
        parse_mode: "Markdown",
      });
      return;
    }
    const code = codeManager.emitAttendanceCode(eventId, ctx.from!.id);
    await ctx.reply(`Код отметки на мероприятие:\n\`${code}\`\n\nДействителен 20 минут.`, { parse_mode: "Markdown" });
  });

  bot.command("managers", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const managers = appStore.managers();
    await ctx.reply(
      managers.length
        ? `Организаторы:\n${managers.map((u) => `\`${u.tgId}\` — ${u.firstName} ${u.lastName}`).join("\n")}`
        : "Организаторов пока нет.",
      { parse_mode: "Markdown" },
    );
  });

  bot.command("add_manager", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const tgId = Number(ctx.match?.toString().trim());
    if (!Number.isInteger(tgId)) {
      await ctx.reply("Использование: /add_manager <telegram_id>\nПользователь должен хотя бы раз написать боту.");
      return;
    }
    const ok = appStore.addManager(tgId);
    await ctx.reply(ok ? "Организатор добавлен." : "Пользователь не найден. Пусть он сначала отправит /start.");
  });

  bot.command("stats", requireAccess(AccessLevel.MANAGER), async (ctx) => {
    const season = await getCurrentSeason();
    const users = appStore.users();
    const registrations = users.reduce((sum, user) => sum + user.registeredEventIds.length, 0);
    const attendances = users.reduce((sum, user) => sum + user.attendedEventIds.length, 0);
    const totalCurrency = users.reduce((sum, user) => sum + Object.values(user.balances).reduce((a, b) => a + b, 0), 0);
    await ctx.reply(
      `*Статистика${season ? ` сезона «${season.title}»` : ""}:*\n` +
        `Пользователей: ${users.length}\n` +
        `Организаторов: ${users.filter((u) => u.isManager).length}\n` +
        `Регистраций на мероприятия: ${registrations}\n` +
        `Посещений: ${attendances}\n` +
        `Выдано валюты: ${totalCurrency}`,
      { parse_mode: "Markdown" },
    );
  });
}

import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { SigmaContext } from "../context";
import { AccessLevel } from "../../api/types";
import { getCurrentSeason } from "../../services/seasons";
import { config } from "../../config";

const HELP_TEXT = `*Меню:*
/start — начать / главное меню
/me — мой профиль, уровень и достижения
/balance — баланс внутренней валюты
/top — таблица лидеров сезона
/events — мероприятия и регистрация на них
/freshman — справка для перваков (что такое Мегабатл, контакты, отборы)
/season — информация о текущем сезоне

Чтобы использовать любой код (перевод валюты, ачивка, отметка на меро) — просто отправьте его мне в чат.

По всем вопросам: обратитесь к организаторам вашего сезона.`;

const ADMIN_HELP_TEXT = `

*Админка:*
/news — разослать новость участникам сезона
/give_currency — выдать/сгенерировать код на валюту
/give_achievement — выдать/сгенерировать код на ачивку
/attendance_code — сгенерировать код отметки на мероприятие
/stats — статистика посещений и валюты
/managers — список организаторов
/add_manager — назначить организатора`;

export function registerStartCommands(bot: Bot<SigmaContext>) {
  bot.command("start", async (ctx) => {
    const greeting =
      ctx.accessLevel === AccessLevel.NOBODY
        ? "Привет! Отправьте /start ещё раз, чтобы создать локальный профиль.\n\n"
        : `Привет, ${ctx.from?.first_name ?? ""}! Рад видеть тебя снова.\n\n`;

    await ctx.reply(greeting + HELP_TEXT + (ctx.accessLevel === AccessLevel.MANAGER ? ADMIN_HELP_TEXT : ""), {
      parse_mode: "Markdown",
      reply_markup: mainKeyboard(ctx.accessLevel === AccessLevel.MANAGER),
    });
    await ctx.reply("Быстрый доступ:", { reply_markup: appKeyboard(ctx.from!.id) });
  });

  bot.command("help", async (ctx) => {
    await ctx.reply(HELP_TEXT + (ctx.accessLevel === AccessLevel.MANAGER ? ADMIN_HELP_TEXT : ""), {
      parse_mode: "Markdown",
      reply_markup: mainKeyboard(ctx.accessLevel === AccessLevel.MANAGER),
    });
  });

  bot.command("app", async (ctx) => {
    await ctx.reply("Mini App с профилем, уровнем, балансом и событиями:", { reply_markup: appKeyboard(ctx.from!.id) });
  });

  bot.command("season", async (ctx) => {
    const season = await getCurrentSeason();
    if (!season) {
      await ctx.reply("Активный сезон не найден.");
      return;
    }
    await ctx.reply(
      `*${season.title}*\n${season.description}\n\n${season.place_title}, ${season.place_address}\n` +
        `${new Date(season.date_begin).toLocaleDateString("ru-RU")} — ${new Date(season.date_end).toLocaleDateString("ru-RU")}`,
      { parse_mode: "Markdown" },
    );
  });
}

function mainKeyboard(isManager: boolean) {
  const keyboard = new Keyboard()
    .text("/me")
    .text("/balance")
    .text("/events")
    .row()
    .text("/top")
    .text("/freshman")
    .text("/app");
  if (isManager) {
    keyboard.row().text("/stats").text("/news").text("/managers");
  }
  return keyboard.resized();
}

function appKeyboard(tgId: number) {
  const baseUrl = config.miniAppUrl || `http://127.0.0.1:${config.miniAppPort}`;
  const url = config.backendMode === "remote" ? baseUrl : `${baseUrl}?tgId=${tgId}`;
  const keyboard = new InlineKeyboard();
  if (url.startsWith("https://")) {
    keyboard.webApp("Открыть Mini App", url);
  } else {
    keyboard.url("Открыть локальный Mini App", url);
  }
  return keyboard;
}

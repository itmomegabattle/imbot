import { Bot, InlineKeyboard, Keyboard } from "grammy";
import { SigmaContext } from "../context";
import { AccessLevel } from "../../api/types";
import { config } from "../../config";
import { backend } from "../../services/backend";

const HELP_TEXT = `*Меню:*
/start — начать / главное меню
/setup Имя | Факультет — заполнить обязательный профиль
/me — мой профиль, уровень и достижения
/balance — баланс внутренней валюты
/transfer ник сумма — перевести валюту (минимум 10)
/top — таблица лидеров сезона
/events — мероприятия и регистрация на них
/team_create, /team_join, /team — командная регистрация
/freshman — справка для перваков (что такое Мегабатл, контакты, отборы)
/season — информация о текущем сезоне

Чтобы использовать любой код (перевод валюты, ачивка, отметка на меро) — просто отправьте его мне в чат.

По всем вопросам: обратитесь к организаторам вашего сезона.`;

const ADMIN_HELP_TEXT = `

*Админка:*
/news текст — рассылка
/give пользователь xp|currency сумма причина — начисление
/achievement пользователь код — ачивка
/reward_code — создать наградной код
/event_create — выпустить мероприятие
/season_start — открыть новый сезон
/set_info — изменить справку
/stats — статистика
/add_admin, /remove_admin — управление администраторами`;

export function registerStartCommands(bot: Bot<SigmaContext>) {
  bot.command("start", async (ctx) => {
    const startPayload = ctx.match?.toString().trim() ?? "";
    const webLogin = /^login_([A-Za-z0-9_-]{32})$/.exec(startPayload);
    if (webLogin) {
      try {
        const result = await backend.approveWebLogin(ctx.from!.id, webLogin[1]);
        await ctx.reply(
          "✅ Вход подтверждён. Сайт авторизуется автоматически — вернись в открытую вкладку.",
          { reply_markup: new InlineKeyboard().url("Вернуться на сайт", result.returnUrl) },
        );
      } catch (error) {
        await ctx.reply("Не удалось подтвердить вход. Вернись на сайт и создай новую ссылку.");
      }
      return;
    }

    const greeting =
      ctx.accessLevel === AccessLevel.NOBODY
        ? "Привет! Не удалось создать профиль, попробуй ещё раз.\n\n"
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
    const season = (await backend.dashboard(ctx.from!.id)).season;
    if (!season) {
      await ctx.reply("Активный сезон не найден.");
      return;
    }
    await ctx.reply(
      `*${season.title}*\nТекущий сезон ITMO Megabattle`,
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
    keyboard.row().text("/stats").text("/news").text("/achievements");
  }
  return keyboard.resized();
}

function appKeyboard(_tgId: number) {
  const baseUrl = config.miniAppUrl || `http://127.0.0.1:${config.miniAppPort}`;
  const url = baseUrl;
  const keyboard = new InlineKeyboard();
  if (url.startsWith("https://")) {
    keyboard.webApp("Открыть Mini App", url);
  } else {
    keyboard.url("Открыть локальный Mini App", url);
  }
  return keyboard;
}

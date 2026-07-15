import { EventInfo, UserAchievementInfo, UserCurrencyInfo } from "../../api/types";

export function formatCurrencies(currencies: UserCurrencyInfo[]): string {
  if (currencies.length === 0) return "пока пусто";
  return currencies.map((c) => `• ${c.currency_name}: *${c.amount}*`).join("\n");
}

export function formatAchievements(achievements: UserAchievementInfo[]): string {
  const visible = achievements.filter((a) => !a.achievement.hidden && a.amount > 0);
  if (visible.length === 0) return "пока нет полученных достижений";
  return visible
    .map((a) => `• ${a.achievement.name}: ${a.amount}${a.achievement.max_amount ? `/${a.achievement.max_amount}` : ""}`)
    .join("\n");
}

export function formatEvent(event: EventInfo): string {
  const begin = new Date(event.date_begin).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" });
  const regInfo = event.registration_required
    ? event.date_reg_end
      ? `\nРегистрация до ${new Date(event.date_reg_end).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" })}`
      : "\nТребуется регистрация"
    : "";
  return `*${event.title}*\n${event.description}\n🕐 ${begin}${regInfo}`;
}

export function shortUuid(id: string): string {
  return id.slice(0, 8);
}

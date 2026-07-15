const tg = window.Telegram?.WebApp;
tg?.ready();
tg?.expand();

const params = new URLSearchParams(window.location.search);
const tgId = params.get("tgId") || tg?.initDataUnsafe?.user?.id;

const text = (id, value) => {
  document.getElementById(id).textContent = value;
};

const empty = (label) => `<div class="item"><p class="muted">${label}</p></div>`;

async function main() {
  if (!tgId && !tg?.initData) {
    document.body.innerHTML = '<main class="shell"><div class="item">Открой Mini App из кнопки в боте.</div></main>';
    return;
  }
  const res = tg?.initData
    ? await fetch("/api/miniapp/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ initData: tg.initData }),
      })
    : await fetch(`/api/miniapp/profile?tgId=${encodeURIComponent(tgId)}`);
  const data = await res.json();
  if (!data.ok) {
    document.body.innerHTML = '<main class="shell"><div class="item">Профиль не найден. Сначала отправь /start боту.</div></main>';
    return;
  }

  text("name", data.user.name || "Участник");
  text("role", data.user.isManager ? "организатор" : "участник");
  text("levelTitle", `${data.level.level}. ${data.level.title}`);
  text("xp", `${data.level.xp} XP`);
  text("nextLevel", data.level.nextLevel ? `До уровня ${data.level.nextLevel}: ${data.level.xpToNext} XP` : "Максимальный уровень сезона");
  text("streak", data.stats?.streak ?? 0);
  text("registrations", data.stats?.registrations ?? 0);
  text("checkins", data.stats?.checkins ?? 0);
  document.getElementById("progress").style.width = `${Math.max(0, Math.min(100, data.level.percent))}%`;

  document.getElementById("balance").innerHTML = data.currencies.length
    ? data.currencies.map((c) => `<article class="tile"><span>${escapeHtml(c.currency_name)}</span><strong>${escapeHtml(c.amount)}</strong></article>`).join("")
    : empty("Баланс пока пустой");

  document.getElementById("events").innerHTML = data.events.length
    ? data.events
        .map(
          (event) => `<article class="item">
            <div class="item-row">
              <strong>${escapeHtml(event.title)}</strong>
              <span class="badge ${event.attended ? "done" : event.registered ? "" : "warn"}">${event.attended ? "посещено" : event.registered ? "регистрация" : "не записан"}</span>
            </div>
            <p class="muted">${event.startsAt ? new Date(event.startsAt).toLocaleString("ru-RU", { dateStyle: "short", timeStyle: "short" }) : "дата уточняется"}</p>
            <p class="muted">${escapeHtml(event.description)}</p>
          </article>`,
        )
        .join("")
    : empty("Событий пока нет");

  const activity = [
    ...data.scoreHistory.map((e) => ({ type: "XP", amount: e.amount, reason: e.reason, createdAt: e.createdAt || e.created_at })),
    ...data.currencyHistory.map((e) => ({ type: "валюта", amount: e.amount, reason: e.reason, createdAt: e.createdAt || e.created_at })),
  ]
    .sort((a, b) => new Date(b.createdAt) - new Date(a.createdAt))
    .slice(0, 8);

  document.getElementById("activity").innerHTML = activity.length
    ? activity
        .map(
          (item) => `<article class="item">
            <div class="item-row">
              <strong>${item.amount > 0 ? "+" : ""}${item.amount} ${item.type}</strong>
              <span class="muted">${new Date(item.createdAt).toLocaleDateString("ru-RU")}</span>
            </div>
            <p class="muted">${escapeHtml(item.reason)}</p>
          </article>`,
        )
        .join("")
    : empty("Истории пока нет");
}

function escapeHtml(value) {
  return String(value ?? "")
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;");
}

main().catch(() => {
  document.body.innerHTML = '<main class="shell"><div class="item">Не удалось загрузить Mini App.</div></main>';
});

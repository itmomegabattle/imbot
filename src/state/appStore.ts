import fs from "fs";
import path from "path";
import { config } from "../config";
import {
  AccessLevel,
  AchievementInfo,
  EventInfo,
  SeasonInfo,
  UserAchievementInfo,
  UserCurrencyInfo,
} from "../api/types";
import { logger } from "../logger";

export interface LocalUser {
  id: string;
  tgId: number;
  username: string | null;
  firstName: string;
  lastName: string;
  isManager: boolean;
  balances: Record<string, number>;
  achievements: Record<string, number>;
  registeredEventIds: string[];
  attendedEventIds: string[];
  createdAt: string;
}

interface LocalCurrency {
  id: string;
  name: string;
  description?: string;
}

interface ScoreEvent {
  id: string;
  tgId: number;
  amount: number;
  reason: string;
  source: "manual" | "attendance" | "code" | "system";
  createdByTgId?: number;
  createdAt: string;
}

interface CurrencyEvent {
  id: string;
  tgId: number;
  currencyId: string;
  amount: number;
  reason: string;
  source: "manual" | "code" | "system";
  createdByTgId?: number;
  createdAt: string;
}

interface AppState {
  users: LocalUser[];
  seasons: SeasonInfo[];
  events: EventInfo[];
  currencies: LocalCurrency[];
  achievements: AchievementInfo[];
  scoreEvents: ScoreEvent[];
  currencyEvents: CurrencyEvent[];
}

interface TelegramProfile {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

const FILE_PATH = path.join(config.dataDir, "app-state.json");

function nowIso() {
  return new Date().toISOString();
}

function uid(prefix: string) {
  return `${prefix}_${Math.random().toString(36).slice(2, 10)}`;
}

function defaultState(): AppState {
  const now = nowIso();
  const seasonId = "season_main";
  return {
    users: [],
    seasons: [
      {
        id: seasonId,
        date_created: now,
        date_updated: now,
        title: "Мегабатл",
        description: "Локальный сезон для Telegram-бота Sigma.",
        place_title: "ИТМО",
        place_address: "Санкт-Петербург",
        date_begin: "2026-01-01T00:00:00.000Z",
        date_end: "2026-12-31T23:59:59.000Z",
        time_shift: 3,
        img_urls: [],
        contacts: [],
      },
    ],
    events: [
      {
        id: "event_opening",
        date_created: now,
        date_updated: now,
        title: "Открытие сезона",
        description: "Стартовая встреча участников, знакомство с правилами и командами.",
        event_type: "meeting",
        date_begin: "2026-09-01T15:00:00.000Z",
        date_end: "2026-09-01T17:00:00.000Z",
        date_reg_begin: "2026-01-01T00:00:00.000Z",
        date_reg_end: "2026-08-31T20:59:59.000Z",
        season_id: seasonId,
        img_urls: [],
        grade: 1,
        registration_required: true,
        team_required: false,
      },
    ],
    currencies: [{ id: "credits", name: "Кредиты", description: "Внутренняя валюта сезона" }],
    achievements: [
      {
        id: "points",
        name: "Очки сезона",
        description: "Основной рейтинг участника",
        max_amount: 0,
        hidden: false,
      },
    ],
    scoreEvents: [],
    currencyEvents: [],
  };
}

const LEVELS = [
  { level: 1, title: "Новичок IMB", minXp: 0 },
  { level: 2, title: "Участник движухи", minXp: 5 },
  { level: 3, title: "Завсегдатай", minXp: 15 },
  { level: 4, title: "Амбассадор", minXp: 30 },
  { level: 5, title: "Легенда сезона", minXp: 60 },
  { level: 6, title: "Мерч-хантер", minXp: 100 },
  { level: 7, title: "Финальный босс", minXp: 160 },
];

class AppStore {
  private state: AppState | null = null;

  load() {
    if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
    if (!fs.existsSync(FILE_PATH)) {
      this.state = defaultState();
      this.persist();
      return;
    }
    try {
      this.state = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8")) as AppState;
      this.normalize();
    } catch (err) {
      logger.error("AppStore: failed to read state, recreating defaults", err);
      this.state = defaultState();
      this.persist();
    }
  }

  private get data(): AppState {
    if (!this.state) this.load();
    return this.state!;
  }

  private persist() {
    if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
    fs.writeFileSync(FILE_PATH, JSON.stringify(this.state, null, 2), "utf-8");
  }

  private normalize() {
    const state = this.state!;
    state.scoreEvents ??= [];
    state.currencyEvents ??= [];
    state.currencies ??= [];
    state.achievements ??= [];
    if (!state.currencies.some((c) => c.id === "credits")) {
      state.currencies.push({ id: "credits", name: "Кредиты", description: "Внутренняя валюта сезона" });
    }
    if (!state.achievements.some((a) => a.id === "points")) {
      state.achievements.push({
        id: "points",
        name: "Очки сезона",
        description: "Основной рейтинг участника",
        max_amount: 0,
        hidden: false,
      });
    }
    for (const user of state.users ?? []) {
      user.balances ??= {};
      user.achievements ??= {};
      user.registeredEventIds ??= [];
      user.attendedEventIds ??= [];
    }
    this.persist();
  }

  ensureUser(profile: TelegramProfile): LocalUser {
    const state = this.data;
    let user = state.users.find((u) => u.tgId === profile.id);
    const firstUser = state.users.length === 0;
    if (!user) {
      user = {
        id: uid("usr"),
        tgId: profile.id,
        username: profile.username ?? null,
        firstName: profile.first_name ?? "Участник",
        lastName: profile.last_name ?? "",
        isManager: profile.id === config.adminTgId || firstUser,
        balances: {},
        achievements: {},
        registeredEventIds: [],
        attendedEventIds: [],
        createdAt: nowIso(),
      };
      state.users.push(user);
      this.persist();
      return user;
    }
    const updated =
      user.username !== (profile.username ?? null) ||
      user.firstName !== (profile.first_name ?? user.firstName) ||
      user.lastName !== (profile.last_name ?? user.lastName) ||
      (profile.id === config.adminTgId && !user.isManager);
    user.username = profile.username ?? null;
    user.firstName = profile.first_name ?? user.firstName;
    user.lastName = profile.last_name ?? user.lastName;
    if (profile.id === config.adminTgId) user.isManager = true;
    if (updated) this.persist();
    return user;
  }

  getAccessLevel(tgId: number): AccessLevel {
    const user = this.data.users.find((u) => u.tgId === tgId);
    if (!user) return AccessLevel.NOBODY;
    return user.isManager ? AccessLevel.MANAGER : AccessLevel.USER;
  }

  getUser(tgId: number): LocalUser | undefined {
    return this.data.users.find((u) => u.tgId === tgId);
  }

  users(): LocalUser[] {
    return [...this.data.users];
  }

  managers(): LocalUser[] {
    return this.users().filter((u) => u.isManager);
  }

  addManager(tgId: number): boolean {
    const user = this.getUser(tgId);
    if (!user) return false;
    user.isManager = true;
    this.persist();
    return true;
  }

  seasons(): SeasonInfo[] {
    return [...this.data.seasons];
  }

  currentSeason(): SeasonInfo | null {
    const seasons = this.seasons();
    if (seasons.length === 0) return null;
    const now = Date.now();
    const active = seasons.find((s) => new Date(s.date_begin).getTime() <= now && now <= new Date(s.date_end).getTime());
    if (active) return active;
    return [...seasons].sort((a, b) => new Date(b.date_end).getTime() - new Date(a.date_end).getTime())[0];
  }

  eventsForCurrentSeason(): EventInfo[] {
    const season = this.currentSeason();
    return season ? this.data.events.filter((e) => e.season_id === season.id) : [];
  }

  registerEvent(tgId: number, eventId: string): "ok" | "missing" | "duplicate" {
    const user = this.getUser(tgId);
    if (!user) return "missing";
    if (!this.data.events.some((e) => e.id === eventId)) return "missing";
    if (user.registeredEventIds.includes(eventId)) return "duplicate";
    user.registeredEventIds.push(eventId);
    this.persist();
    return "ok";
  }

  unregisterEvent(tgId: number, eventId: string): "ok" | "missing" {
    const user = this.getUser(tgId);
    if (!user) return "missing";
    user.registeredEventIds = user.registeredEventIds.filter((id) => id !== eventId);
    this.persist();
    return "ok";
  }

  currencies(): LocalCurrency[] {
    return [...this.data.currencies];
  }

  achievements(): AchievementInfo[] {
    return [...this.data.achievements];
  }

  userCurrencies(tgId: number): UserCurrencyInfo[] {
    const user = this.getUser(tgId);
    if (!user) return [];
    return this.data.currencies.map((c) => ({
      currency_id: c.id,
      currency_name: c.name,
      currency_description: c.description ?? null,
      amount: String(user.balances[c.id] ?? 0),
    }));
  }

  userAchievements(tgId: number): UserAchievementInfo[] {
    const user = this.getUser(tgId);
    if (!user) return [];
    return this.data.achievements.map((achievement) => ({
      achievement,
      amount: user.achievements[achievement.id] ?? 0,
    }));
  }

  xp(tgId: number): number {
    return this.getUser(tgId)?.achievements.points ?? 0;
  }

  levelProgress(tgId: number) {
    const xp = this.xp(tgId);
    const current = [...LEVELS].reverse().find((level) => xp >= level.minXp) ?? LEVELS[0];
    const next = LEVELS.find((level) => level.minXp > xp) ?? null;
    return {
      xp,
      level: current.level,
      title: current.title,
      currentMinXp: current.minXp,
      nextLevel: next?.level ?? null,
      nextTitle: next?.title ?? null,
      nextMinXp: next?.minXp ?? null,
      xpToNext: next ? next.minXp - xp : 0,
      percent: next ? Math.round(((xp - current.minXp) / (next.minXp - current.minXp)) * 100) : 100,
    };
  }

  scoreHistory(tgId: number): ScoreEvent[] {
    return this.data.scoreEvents
      .filter((event) => event.tgId === tgId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  currencyHistory(tgId: number): CurrencyEvent[] {
    return this.data.currencyEvents
      .filter((event) => event.tgId === tgId)
      .sort((a, b) => new Date(b.createdAt).getTime() - new Date(a.createdAt).getTime());
  }

  addXp(tgId: number, amount: number, reason: string, source: ScoreEvent["source"], createdByTgId?: number) {
    this.giveAchievement(tgId, "points", amount);
    this.data.scoreEvents.push({
      id: uid("score"),
      tgId,
      amount,
      reason,
      source,
      createdByTgId,
      createdAt: nowIso(),
    });
    this.persist();
  }

  deposit(tgId: number, currencyId: string, amount: number, reason = "Начисление", source: CurrencyEvent["source"] = "system", createdByTgId?: number) {
    const user = this.getUser(tgId);
    if (!user) throw new Error("User not found");
    user.balances[currencyId] = (user.balances[currencyId] ?? 0) + amount;
    this.data.currencyEvents.push({
      id: uid("currency"),
      tgId,
      currencyId,
      amount,
      reason,
      source,
      createdByTgId,
      createdAt: nowIso(),
    });
    this.persist();
  }

  giveAchievement(tgId: number, achievementId: string, amount: number) {
    const user = this.getUser(tgId);
    if (!user) throw new Error("User not found");
    user.achievements[achievementId] = (user.achievements[achievementId] ?? 0) + amount;
    this.persist();
  }

  markAttendance(tgId: number, eventId: string): "ok" | "missing" | "duplicate" {
    const user = this.getUser(tgId);
    if (!user || !this.data.events.some((e) => e.id === eventId)) return "missing";
    if (user.attendedEventIds.includes(eventId)) return "duplicate";
    user.attendedEventIds.push(eventId);
    this.addXp(tgId, 1, `Посещение мероприятия ${eventId}`, "attendance");
    this.persist();
    return "ok";
  }

  leaderboard() {
    return this.users()
      .map((user) => ({
        user,
        points: Object.values(user.achievements).reduce((sum, value) => sum + value, 0),
      }))
      .sort((a, b) => b.points - a.points);
  }
}

export const appStore = new AppStore();

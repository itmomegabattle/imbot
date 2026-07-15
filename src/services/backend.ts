import axios, { AxiosInstance } from "axios";
import { config } from "../config";

export interface BackendDashboard {
  ok: boolean;
  user: { id: string; tgId: number; name: string; username?: string | null; avatarUrl?: string | null; isManager: boolean };
  level: {
    xp: number;
    level: number;
    title: string;
    nextLevel: number | null;
    nextTitle: string | null;
    nextMinXp: number | null;
    xpToNext: number;
    percent: number;
  };
  stats: { streak: number; registrations: number; checkins: number };
  currencies: Array<{ currency_id: string; currency_name: string; currency_description?: string | null; amount: string }>;
  events: Array<{
    id: string;
    title: string;
    description?: string | null;
    startsAt?: string | null;
    registrationStatus?: string;
    registered: boolean;
    attended: boolean;
  }>;
  scoreHistory: Array<{ amount: number; reason: string; createdAt?: string; created_at?: string }>;
  currencyHistory: Array<{ amount: number; reason: string; createdAt?: string; created_at?: string }>;
}

export interface BackendEvent {
  id: string;
  slug: string;
  name: string;
  type?: string | null;
  description?: string | null;
  starts_at?: string | null;
  ends_at?: string | null;
  location?: string | null;
  image_url?: string | null;
  registration_status: "open" | "soon" | "closed";
  registration_link?: string | null;
}

class BackendClient {
  private readonly http: AxiosInstance;

  constructor() {
    this.http = axios.create({
      baseURL: `${config.apiBaseUrl}/api/v1/participant`,
      timeout: 15_000,
      headers: config.serviceToken ? { "X-Service-Token": config.serviceToken } : undefined,
    });
  }

  async upsertTelegramUser(user: { id: number; username?: string; first_name?: string; last_name?: string }) {
    const { data } = await this.http.post<{ profileId: string; telegramId: number; roles: string[] }>("/bot/users/upsert", {
      telegramId: user.id,
      username: user.username ?? null,
      firstName: user.first_name ?? "Участник",
      lastName: user.last_name ?? null,
    });
    return data;
  }

  async dashboard(telegramId: number) {
    const { data } = await this.http.get<BackendDashboard>(`/bot/users/${telegramId}/dashboard`);
    return data;
  }

  async leaderboard(limit = 20) {
    const { data } = await this.http.get<{ leaderboard: Array<{ place: number; profile_id: string; nickname: string; full_name?: string | null; xp: number }> }>(
      "/leaderboard",
      { params: { limit } },
    );
    return data.leaderboard;
  }

  async events() {
    const { data } = await this.http.get<{ events: BackendEvent[] }>("/events");
    return data.events;
  }

  async registerEvent(telegramId: number, eventId: string) {
    await this.http.post(`/events/${eventId}/registrations`, { telegramId });
  }

  async unregisterEvent(telegramId: number, eventId: string) {
    await this.http.delete(`/events/${eventId}/registrations/${telegramId}`);
  }
}

export const backend = new BackendClient();
export const usesRemoteBackend = config.backendMode === "remote";

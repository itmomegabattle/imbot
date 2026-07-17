import axios, { AxiosInstance, AxiosRequestConfig } from "axios";
import { config } from "../config";

export interface BackendDashboard {
  ok: boolean;
  user: { id: string; tgId: number; name: string; username?: string | null; avatarUrl?: string | null; faculty?: string | null; onboardingCompleted: boolean; isManager: boolean };
  season?: { id: string; title: string };
  level: { xp: number; level: number; title: string; nextLevel: number | null; nextTitle: string | null; nextMinXp: number | null; xpToNext: number; percent: number };
  stats: { friends: number; registrations: number; checkins: number };
  currencies: Array<{ code: string; name: string; amount: number }>;
  facultyBalance: number;
  achievements: Array<{ code: string; name: string; description?: string | null; amount: number }>;
  events: BackendEvent[];
  scoreHistory: Array<{ amount: number; reason: string; created_at: string }>;
  currencyHistory: Array<{ amount: number; reason: string; created_at: string }>;
}

export interface BackendEvent {
  id: string; slug?: string; name?: string; title?: string; description?: string | null;
  starts_at?: string | null; startsAt?: string | null; location?: string | null; image_url?: string | null;
  registration_status?: "open" | "soon" | "closed"; registrationStatus?: string;
  registration_mode?: string; registrationMode?: string; registration_link?: string | null; registrationLink?: string | null;
  minTeamSize?: number | null; maxTeamSize?: number | null; registered?: boolean;
}

class BackendClient {
  private readonly service: AxiosInstance;
  private readonly api: AxiosInstance;
  private readonly sessions = new Map<number, { token: string; expiresAt: number }>();

  constructor() {
    this.service = axios.create({ baseURL: `${config.apiBaseUrl}/api/v1/participant`, timeout: 20_000, headers: { "X-Service-Token": config.serviceToken } });
    this.api = axios.create({ baseURL: config.apiBaseUrl, timeout: 20_000 });
  }

  async upsertTelegramUser(user: { id: number; username?: string; first_name?: string; last_name?: string }) {
    const { data } = await this.service.post<{ profileId: string; telegramId: number; roles: string[] }>("/bot/users/upsert", {
      telegramId: user.id, username: user.username ?? null, firstName: user.first_name ?? "Участник", lastName: user.last_name ?? null,
    });
    this.sessions.delete(user.id);
    return data;
  }

  async approveWebLogin(telegramId: number, startToken: string) {
    const { data } = await this.api.post<{ ok: true; returnUrl: string; expiresIn: number }>(
      "/auth/service/telegram-web-login/approve",
      { telegramId, startToken },
      { headers: { "X-Service-Token": config.serviceToken } },
    );
    return data;
  }

  private async token(telegramId: number) {
    const cached = this.sessions.get(telegramId);
    if (cached && cached.expiresAt > Date.now() + 60_000) return cached.token;
    const { data } = await this.api.post<{ token: string; expiresIn: number }>("/auth/service/participant-session", { telegramId }, { headers: { "X-Service-Token": config.serviceToken } });
    this.sessions.set(telegramId, { token: data.token, expiresAt: Date.now() + data.expiresIn * 1000 });
    return data.token;
  }

  private async asUser<T>(telegramId: number, options: AxiosRequestConfig): Promise<T> {
    const token = await this.token(telegramId);
    const { data } = await this.api.request<T>({ ...options, headers: { ...options.headers, Authorization: `Bearer ${token}` } });
    return data;
  }

  async dashboard(telegramId: number) { const { data } = await this.service.get<BackendDashboard>(`/bot/users/${telegramId}/dashboard`); return data; }
  async leaderboard(limit = 20) { const { data } = await this.service.get<{ leaderboard: any[] }>("/leaderboard", { params: { limit } }); return data.leaderboard; }
  async events() { const { data } = await this.service.get<{ events: BackendEvent[] }>("/events"); return data.events; }
  async profile(telegramId: number) { return this.asUser<any>(telegramId, { method: "GET", url: "/api/v1/profile" }); }
  async updateProfile(telegramId: number, patch: Record<string, unknown>) { return this.asUser<any>(telegramId, { method: "PATCH", url: "/api/v1/profile", data: patch }); }
  async publicProfile(nicknameOrId: string) { const { data } = await this.api.get<any>(`/api/v1/profiles/${encodeURIComponent(nicknameOrId)}`); return data; }
  async transfer(telegramId: number, receiverProfileId: string, amount: number, idempotencyKey: string) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/game/transfers", data: { receiverProfileId, amount, idempotencyKey } }); }
  async redeem(telegramId: number, code: string) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/game/rewards/redeem", data: { code } }); }
  async registerEvent(telegramId: number, eventId: string) { return this.asUser<any>(telegramId, { method: "POST", url: `/api/v1/events/${eventId}/register` }); }
  async unregisterEvent(telegramId: number, eventId: string) { return this.asUser<any>(telegramId, { method: "DELETE", url: `/api/v1/events/${eventId}/register` }); }
  async createTeam(telegramId: number, eventId: string, name: string) { return this.asUser<any>(telegramId, { method: "POST", url: `/api/v1/events/${eventId}/teams`, data: { name } }); }
  async joinTeam(telegramId: number, code: string) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/events/teams/join", data: { code } }); }
  async getTeam(telegramId: number, eventId: string) { return this.asUser<any>(telegramId, { method: "GET", url: `/api/v1/events/${eventId}/team` }); }
  async teamAction(telegramId: number, teamId: string, action: Record<string, unknown>) { return this.asUser<any>(telegramId, { method: "PATCH", url: `/api/v1/events/teams/${teamId}`, data: action }); }
  async info() { const { data } = await this.api.get<{ sections: any[] }>("/api/v1/info"); return data.sections; }
  async setInfo(telegramId: number, key: string, value: { title: string; body: string }) { return this.asUser<any>(telegramId, { method: "PUT", url: `/api/v1/admin/info/${key}`, data: value }); }
  async adminStats(telegramId: number) { return this.asUser<any>(telegramId, { method: "GET", url: "/api/v1/admin/stats" }); }
  async adminProfiles(telegramId: number, search: string, limit = 10) { return this.asUser<any>(telegramId, { method: "GET", url: "/api/v1/admin/profiles", params: { search, limit } }); }
  async adminTransaction(telegramId: number, profileId: string, type: "xp" | "currency", amount: number, reason: string, idempotencyKey: string) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/game/transactions", data: { profileId, type, amount, reason, idempotencyKey } }); }
  async achievements(telegramId: number) { return this.asUser<any>(telegramId, { method: "GET", url: "/api/v1/admin/game/achievements" }); }
  async saveAchievement(telegramId: number, data: Record<string, unknown>) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/game/achievements", data }); }
  async grantAchievement(telegramId: number, profileId: string, achievementCode: string, amount: number, idempotencyKey: string) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/game/achievements/grant", data: { profileId, achievementCode, amount, idempotencyKey } }); }
  async broadcast(telegramId: number, text: string, mediaFileId: string | undefined, idempotencyKey: string) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/broadcasts", data: { text, mediaFileId, idempotencyKey } }); }
  async setAdmin(telegramId: number, profileId: string, enabled: boolean) { return this.asUser<any>(telegramId, { method: enabled ? "PUT" : "DELETE", url: `/api/v1/admin/profiles/${profileId}/roles/admin` }); }
  async createRewardCode(telegramId: number, data: Record<string, unknown>) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/game/reward-codes", data }); }
  async createEvent(telegramId: number, data: Record<string, unknown>) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/content/events", data }); }
  async startSeason(telegramId: number, data: Record<string, unknown>) { return this.asUser<any>(telegramId, { method: "POST", url: "/api/v1/admin/seasons", data }); }
}

export const backend = new BackendClient();

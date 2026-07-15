/* Типы отражают pydantic-схемы sigma_backend/schemas/*.
   Держим их синхронизированными вручную с бэком. */

export type UUID = string;

export enum AccessLevel {
  NOBODY = 1,
  USER = 2,
  MANAGER = 4,
}

export interface UserInfo {
  id: UUID;
  short_id: number;
  name: string;
  surname: string;
  patronymic?: string | null;
  gmail?: string | null;
  vk_url?: string | null;
  telegram_url?: string | null;
  telegram_user_id?: number | null;
  birthday?: string | null;
  school?: string | null;
  grade?: number | null;
  phone?: string | null;
  date_created: string;
  date_updated: string;
  user_type: string;
  img_urls: string[];
}

export interface SeasonContact {
  url: string;
  title: string;
}

export interface SeasonInfo {
  id: UUID;
  date_created: string;
  date_updated: string;
  title: string;
  description: string;
  place_title: string;
  place_address: string;
  date_begin: string;
  date_end: string;
  time_shift: number;
  img_urls: string[];
  help_url?: string | null;
  contacts: SeasonContact[];
}

export interface GetSeasonsResponse {
  seasons: SeasonInfo[];
}

export interface EventInfo {
  id: UUID;
  date_created: string;
  date_updated: string;
  title: string;
  description: string;
  team_required?: boolean | null;
  registration_required?: boolean | null;
  event_type: string;
  note?: string | null;
  date_begin: string;
  date_end: string;
  date_reg_begin?: string | null;
  date_reg_end?: string | null;
  season_id: UUID;
  img_urls: string[];
  grade: number;
  max_grade?: number | null;
}

export interface GetEventsResponse {
  events: EventInfo[];
}

export interface UserCurrencyInfo {
  currency_id: UUID;
  currency_name: string;
  currency_description?: string | null;
  currency_icon_url?: string | null;
  amount: string; // Decimal передаётся как строка/число в JSON, приводим к строке для точности
}

export interface GetUserCurrenciesResponse {
  user_currencies: UserCurrencyInfo[];
}

export interface CurrencyInfo {
  id: UUID;
  name: string;
}

export interface GetCurrenciesResponse {
  currencies: CurrencyInfo[];
}

export interface AchievementInfo {
  id: UUID;
  name: string;
  description?: string | null;
  max_amount: number;
  icon_url?: string | null;
  display_mode?: string | null;
  hidden: boolean;
}

export interface UserAchievementInfo {
  achievement: AchievementInfo;
  amount: number;
}

export interface GetUserAchievementsResponse {
  achievements: UserAchievementInfo[];
}

export interface LeaderboardEntry {
  id: UUID;
  name: string;
  surname: string;
  short_id: number;
  achievements: UserAchievementInfo[];
  currencies: UserCurrencyInfo[];
}

export interface GetLeaderboardResponse {
  leaderboard: LeaderboardEntry[];
}

export interface IsAdminResponse {
  is_admin: boolean;
}

export interface TokenResponse {
  token: string;
  type: "ACCESS" | "DATA";
}

export interface BaseResponse {
  description: string;
}

export interface BaseIntResponse extends BaseResponse {
  value: number;
}

export interface TelegramMessage {
  id: UUID;
  user_id: number;
  text: string;
}

export interface TelegramMessagesResponse {
  messages: TelegramMessage[];
}

export interface GetAchievementsResponse {
  achievements: AchievementInfo[];
}

export interface UserPreviewInfoLike {
  id: UUID;
  short_id: number;
  name: string;
  surname: string;
  vk_url?: string | null;
  telegram_url?: string | null;
  telegram_user_id?: number | null;
}

export interface AdminAddRequest {
  id: UUID; // db_user_id
}

import { AccessLevel } from "../api/types";
import { backend } from "./backend";

interface TelegramProfile {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function getAccessLevel(profile: TelegramProfile): Promise<AccessLevel> {
  const remote = await backend.upsertTelegramUser(profile);
  return remote.roles.some((role) => ["admin", "site_admin"].includes(role)) ? AccessLevel.MANAGER : AccessLevel.USER;
}

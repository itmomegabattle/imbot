import { AccessLevel } from "../api/types";
import { appStore } from "../state/appStore";
import { userStore, BotUser } from "../state/userStore";
import { backend, usesRemoteBackend } from "./backend";

interface TelegramProfile {
  id: number;
  username?: string;
  first_name?: string;
  last_name?: string;
}

export async function getAccessLevel(profile: TelegramProfile): Promise<AccessLevel> {
  const localUser = appStore.ensureUser(profile);
  if (usesRemoteBackend) {
    const remote = await backend.upsertTelegramUser(profile);
    userStore.set(profile.id, {
      tgNickname: profile.username ?? null,
      token: "backend-service",
      dbUserId: remote.profileId,
    });
    return remote.roles.some((role) => ["organizer", "admin", "site_admin"].includes(role))
      ? AccessLevel.MANAGER
      : AccessLevel.USER;
  }
  userStore.set(profile.id, {
    tgNickname: profile.username ?? null,
    token: "local",
    dbUserId: localUser.id,
  });
  return appStore.getAccessLevel(profile.id);
}

export function requireLoggedIn(user: BotUser): asserts user is BotUser & { token: string; dbUserId: string } {
  if (!user.token || !user.dbUserId) {
    throw new Error("User is not authorized");
  }
}

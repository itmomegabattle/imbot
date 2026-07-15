import fs from "fs";
import path from "path";
import { config } from "../config";
import { logger } from "../logger";

export interface BotUser {
  tgId: number;
  tgNickname: string | null;
  token: string | null;
  dbUserId: string | null;
}

const FILE_PATH = path.join(config.dataDir, "users.json");

function ensureDataDir() {
  if (!fs.existsSync(config.dataDir)) {
    fs.mkdirSync(config.dataDir, { recursive: true });
  }
}

/**
 * Хранит соответствие tg_id -> (токен доступа в sigma_backend, db_user_id, ник).
 * В Python-версии это было поле Api.users, сериализуемое в state/api.txt.
 * Здесь — простой JSON-файл + in-memory кэш, т.к. Node однопоточный и гонок
 * данных внутри одного процесса не возникает.
 */
class UserStore {
  private users = new Map<number, BotUser>();
  private loaded = false;

  load() {
    ensureDataDir();
    if (fs.existsSync(FILE_PATH)) {
      try {
        const raw = fs.readFileSync(FILE_PATH, "utf-8");
        const parsed: BotUser[] = JSON.parse(raw);
        for (const u of parsed) this.users.set(u.tgId, u);
        logger.info(`UserStore: loaded ${this.users.size} users from ${FILE_PATH}`);
      } catch (err) {
        logger.error("UserStore: failed to load state, starting fresh", err);
      }
    }
    this.loaded = true;
  }

  private persist() {
    ensureDataDir();
    const data = JSON.stringify([...this.users.values()], null, 2);
    fs.writeFileSync(FILE_PATH, data, "utf-8");
  }

  get(tgId: number): BotUser {
    if (!this.loaded) this.load();
    const existing = this.users.get(tgId);
    if (existing) return existing;
    const fresh: BotUser = { tgId, tgNickname: null, token: null, dbUserId: null };
    this.users.set(tgId, fresh);
    return fresh;
  }

  set(tgId: number, patch: Partial<BotUser>) {
    const current = this.get(tgId);
    const updated = { ...current, ...patch, tgId };
    this.users.set(tgId, updated);
    this.persist();
    return updated;
  }

  invalidateToken(tgId: number) {
    this.set(tgId, { token: null, dbUserId: null });
  }

  all(): BotUser[] {
    if (!this.loaded) this.load();
    return [...this.users.values()];
  }

  findByDbUserId(dbUserId: string): BotUser | undefined {
    return this.all().find((u) => u.dbUserId === dbUserId);
  }
}

export const userStore = new UserStore();

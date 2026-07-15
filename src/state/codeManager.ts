import crypto from "crypto";
import fs from "fs";
import path from "path";
import { config } from "../config";
import { userStore } from "./userStore";
import { logger } from "../logger";
import { appStore } from "./appStore";

export class CodeError extends Error {}

const CODE_LENGTH = 6;
const DEFAULT_TTL_MS = 20 * 60 * 1000; // 20 минут — для регистрации/посещаемости
const LONG_TTL_MS = 90 * 24 * 60 * 60 * 1000; // 90 дней — для переводов/ачивок
const FILE_PATH = path.join(config.dataDir, "codes.json");

type CodeKind = "transfer" | "achievement" | "attendance";

interface StoredCode {
  data: string;
  kind: CodeKind;
  createdAt: number;
  ttlMs: number;
  used: boolean;
  payload: TransferPayload | AchievementPayload | AttendancePayload;
}

interface TransferPayload {
  currencyId: string;
  amount: string;
}

interface AchievementPayload {
  achievementId: string;
  amount: number;
}

interface AttendancePayload {
  eventId: string;
  adminTgId: number;
}

function generateCode(): string {
  let out = "";
  for (let i = 0; i < CODE_LENGTH; i++) out += crypto.randomInt(0, 10).toString();
  return out;
}

/**
 * Хранит одноразовые/ограниченные по времени коды: перевод валюты, выдача
 * ачивки, отметка посещаемости. Аналог CodeManager из sigma_bot/code_manager.py.
 * В отличие от исходника, где хранилище было общим для всех видов кодов и
 * сериализовалось целиком через pickle, здесь — плоский JSON-файл, который
 * переживает рестарт процесса.
 */
class CodeManager {
  private codes = new Map<string, StoredCode>();
  private loaded = false;

  private load() {
    if (this.loaded) return;
    if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
    if (fs.existsSync(FILE_PATH)) {
      try {
        const raw: StoredCode[] = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
        for (const c of raw) this.codes.set(c.data, c);
      } catch (err) {
        logger.error("CodeManager: failed to load state, starting fresh", err);
      }
    }
    this.loaded = true;
  }

  private persist() {
    fs.writeFileSync(FILE_PATH, JSON.stringify([...this.codes.values()], null, 2), "utf-8");
  }

  private isActive(code: StoredCode): boolean {
    return !code.used && Date.now() - code.createdAt <= code.ttlMs;
  }

  private sweep() {
    let changed = false;
    for (const [key, code] of this.codes) {
      if (!this.isActive(code)) {
        this.codes.delete(key);
        changed = true;
      }
    }
    if (changed) this.persist();
  }

  emitTransferCode(currencyId: string, amount: string): string {
    this.load();
    this.sweep();
    const data = generateCode();
    this.codes.set(data, {
      data,
      kind: "transfer",
      createdAt: Date.now(),
      ttlMs: LONG_TTL_MS,
      used: false,
      payload: { currencyId, amount },
    });
    this.persist();
    return data;
  }

  emitAchievementCode(achievementId: string, amount: number): string {
    this.load();
    this.sweep();
    const data = generateCode();
    this.codes.set(data, {
      data,
      kind: "achievement",
      createdAt: Date.now(),
      ttlMs: LONG_TTL_MS,
      used: false,
      payload: { achievementId, amount },
    });
    this.persist();
    return data;
  }

  emitAttendanceCode(eventId: string, adminTgId: number): string {
    this.load();
    this.sweep();
    const data = generateCode();
    this.codes.set(data, {
      data,
      kind: "attendance",
      createdAt: Date.now(),
      ttlMs: DEFAULT_TTL_MS,
      used: false,
      payload: { eventId, adminTgId },
    });
    this.persist();
    return data;
  }

  has(data: string): boolean {
    this.load();
    this.sweep();
    return this.codes.has(data);
  }

  /** Применяет код от лица пользователя userTgId. Бросает CodeError с человекочитаемым текстом. */
  async use(data: string, userTgId: number): Promise<string> {
    this.load();
    this.sweep();
    const code = this.codes.get(data);
    if (!code) throw new CodeError("Нет такого кода, либо он уже истёк.");

    try {
      switch (code.kind) {
        case "transfer": {
          const p = code.payload as TransferPayload;
          appStore.deposit(userTgId, p.currencyId, Number(p.amount), "Одноразовый код", "code");
          code.used = true;
          this.persist();
          return "Валюта успешно зачислена!";
        }
        case "achievement": {
          const p = code.payload as AchievementPayload;
          if (p.achievementId === "points") {
            appStore.addXp(userTgId, p.amount, "Одноразовый код", "code");
          } else {
            appStore.giveAchievement(userTgId, p.achievementId, p.amount);
          }
          code.used = true;
          this.persist();
          return "Ачивка успешно выдана!";
        }
        case "attendance": {
          const p = code.payload as AttendancePayload;
          const adminUser = userStore.get(p.adminTgId);
          if (!adminUser.token) {
            throw new CodeError("Код больше не действителен (у организатора истекла сессия).");
          }
          const result = appStore.markAttendance(userTgId, p.eventId);
          if (result === "duplicate") {
            throw new CodeError("Отметиться не удалось. Возможно, вы уже отмечались сегодня.");
          }
          if (result === "missing") throw new CodeError("Мероприятие не найдено.");
          code.used = true;
          this.persist();
          return "Вы успешно отмечены на мероприятии!";
        }
      }
    } catch (err) {
      if (err instanceof CodeError) throw err;
      logger.error(`CodeManager.use failed for code=${data}`, err);
      throw new CodeError("Не удалось применить код. Попробуйте ещё раз чуть позже.");
    }
  }
}

export const codeManager = new CodeManager();

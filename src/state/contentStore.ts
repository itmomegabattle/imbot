import fs from "fs";
import path from "path";
import { config } from "../config";

const FILE_PATH = path.join(config.dataDir, "content.json");

export interface ContentSection {
  title: string;
  defaultText: string;
}

/**
 * Разделы "Информационной справки для перваков" из ТЗ:
 * про их мегафакультет, контакты ответственных, справка по мероприятиям,
 * правила Мегабатла для перваков, отборы на концерт.
 * Текст редактируется организаторами прямо в боте командой /set_info,
 * а не зашивается в код — таблица в макете явно помечена как черновик.
 */
export const CONTENT_SECTIONS: Record<string, ContentSection> = {
  mf: {
    title: "Про мегафакультеты",
    defaultText: "Раздел ещё не заполнен организаторами. Загляни позже или спроси у ответственного за твой поток.",
  },
  contacts: {
    title: "Контакты ответственных",
    defaultText: "Раздел ещё не заполнен организаторами.",
  },
  events_overview: {
    title: "Справка по мероприятиям (что это и для кого)",
    defaultText: "Раздел ещё не заполнен организаторами.",
  },
  megabattle_rules: {
    title: "Правила Мегабатла для перваков",
    defaultText: "Раздел ещё не заполнен организаторами.",
  },
  concert_selection: {
    title: "Про отборы на концерт",
    defaultText: "Раздел ещё не заполнен организаторами.",
  },
};

class ContentStore {
  private data: Record<string, string> = {};
  private loaded = false;

  private load() {
    if (this.loaded) return;
    if (!fs.existsSync(config.dataDir)) fs.mkdirSync(config.dataDir, { recursive: true });
    if (fs.existsSync(FILE_PATH)) {
      try {
        this.data = JSON.parse(fs.readFileSync(FILE_PATH, "utf-8"));
      } catch {
        this.data = {};
      }
    }
    this.loaded = true;
  }

  get(key: string): string {
    this.load();
    return this.data[key] ?? CONTENT_SECTIONS[key]?.defaultText ?? "Раздел не найден.";
  }

  set(key: string, text: string) {
    this.load();
    this.data[key] = text;
    fs.writeFileSync(FILE_PATH, JSON.stringify(this.data, null, 2), "utf-8");
  }
}

export const contentStore = new ContentStore();

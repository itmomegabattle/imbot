import { SeasonInfo } from "../api/types";
import { appStore } from "../state/appStore";

export async function listSeasons(): Promise<SeasonInfo[]> {
  return appStore.seasons();
}

export async function getCurrentSeason(): Promise<SeasonInfo | null> {
  return appStore.currentSeason();
}

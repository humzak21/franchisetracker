import { isWeekKey, type WeekKey } from "@shared/domain";
import { isTargetKey, type TargetKey } from "@shared/ingestion/targets";

/**
 * What a link to manual entry can preset: the target, and its season and week or its game.
 * Ids stay plain strings so any screen can link here; the server checks them.
 */
export type ManualSearch = {
  target?: TargetKey;
  seasonId?: string;
  weekKey?: WeekKey;
  gameId?: string;
};

const text = (value: unknown) => (typeof value === "string" && value !== "" ? value : undefined);

/** Reads the start screen's search params; anything unknown is dropped. */
export function parseManualSearch(search: Record<string, unknown>): ManualSearch {
  const target = text(search.target);
  const weekKey = text(search.weekKey);
  const seasonId = text(search.seasonId);
  const gameId = text(search.gameId);
  return {
    ...(target && isTargetKey(target) ? { target } : {}),
    ...(weekKey && isWeekKey(weekKey) ? { weekKey } : {}),
    ...(seasonId ? { seasonId } : {}),
    ...(gameId ? { gameId } : {}),
  };
}

import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { INGESTION_TARGETS, isTargetKey } from "@shared/ingestion/targets";
import { useQuery } from "@/lib/convex/useQuery";

/**
 * The game a game-scoped list or a full game log's plays are checked against: its final and box
 * score, read live so a game log committed while this list waits for review counts. Undefined for
 * any other target.
 */
export function useRowGame(target: string | null | undefined, gameId: Id<"games"> | null | undefined) {
  const def = target && isTargetKey(target) ? INGESTION_TARGETS[target] : null;
  const wanted = target === "game_log" || (def?.kind === "rows" && def.scope === "game");
  return useQuery(api.games.scoring.reviewContext, wanted ? { gameId: gameId ?? null } : "skip");
}

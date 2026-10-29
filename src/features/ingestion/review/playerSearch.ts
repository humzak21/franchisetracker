import { useAction } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useEffect, useState } from "react";
import { api } from "@convex/_generated/api";
import { useQuery } from "@/lib/convex/useQuery";
import { useDebouncedValue } from "@/lib/hooks/useDebouncedValue";
import { useLastDefined } from "@/lib/hooks/useLastDefined";

/** Franchise search is a cheap indexed read; ESPN is a slow round trip, so it waits for a pause. */
const PLAYER_DELAY_MS = 150;
const PROSPECT_DELAY_MS = 450;
const MIN_PLAYER_TEXT = 2;
const MIN_PROSPECT_TEXT = 3;

export type FoundPlayer = FunctionReturnType<typeof api.players.search.byName>[number];
export type Prospect = FunctionReturnType<typeof api.players.espn.prospects>[number];

/**
 * Franchise players matching typed text. Results stay on screen while the next ones load, so
 * the list never empties between keystrokes.
 */
export function usePlayerSearch(text: string, enabled: boolean) {
  const typed = text.trim();
  const query = useDebouncedValue(typed, PLAYER_DELAY_MS);
  const wanted = enabled && query.length >= MIN_PLAYER_TEXT ? query : null;
  const live = useQuery(api.players.search.byName, wanted === null ? "skip" : { text: wanted });
  const kept = useLastDefined(live);
  const active = enabled && typed.length >= MIN_PLAYER_TEXT;
  return {
    players: active ? (kept ?? []) : [],
    searching: active && (query !== typed || live === undefined),
  };
}

/** College football players on ESPN matching typed text, for a draft pick that is a real prospect. */
export function useProspectSearch(text: string, enabled: boolean) {
  const search = useAction(api.players.espn.prospects);
  const typed = text.trim();
  const query = useDebouncedValue(typed, PROSPECT_DELAY_MS);
  const wanted = enabled && query.length >= MIN_PROSPECT_TEXT ? query : null;
  const [answer, setAnswer] = useState<{ query: string; prospects: Prospect[]; failed: boolean }>();

  useEffect(() => {
    if (wanted === null) return;
    // A slower answer to an older query never replaces a newer one.
    let current = true;
    search({ text: wanted }).then(
      (prospects) => current && setAnswer({ query: wanted, prospects, failed: false }),
      () => current && setAnswer({ query: wanted, prospects: [], failed: true }),
    );
    return () => {
      current = false;
    };
  }, [search, wanted]);

  const active = enabled && typed.length >= MIN_PROSPECT_TEXT;
  return {
    prospects: active ? (answer?.prospects ?? []) : [],
    searching: active && answer?.query !== typed,
    failed: active && answer?.query === typed && answer.failed,
  };
}

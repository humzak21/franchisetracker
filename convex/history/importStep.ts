/**
 * What every import step shares (`nflverseImport.runStep`): its arguments and result, fetching an
 * nflverse file, and writing parsed rows in batches.
 */
import type { Id } from "../_generated/dataModel";

const FETCH_TIMEOUT_MS = 120_000;
const BATCH = 250;

export type Job = { startYear: number; userTeamId: Id<"teams">; firstYear: number | null };
export type StepArgs = { franchiseId: Id<"franchises">; step: string; cursor?: string };
export type Counts = {
  seasons?: number;
  players?: number;
  statRows?: number;
  draftPicks?: number;
  rosterEntries?: number;
};
export type StepResult = {
  counts: Counts;
  plan?: string[];
  firstYear?: number;
  lastYear?: number;
  continueCursor?: string;
};

/** A file's text, or null when it is not published (404), e.g. a season's postseason file. */
export async function fetchOptional(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`nflverse returned ${res.status} for ${url}`);
  return await res.text();
}

export async function fetchText(url: string): Promise<string> {
  const text = await fetchOptional(url);
  if (text === null) throw new Error(`nflverse has no ${url}`);
  return text;
}

export async function batches<T>(
  items: readonly T[],
  write: (batch: T[]) => Promise<number>,
): Promise<number> {
  let total = 0;
  for (let i = 0; i < items.length; i += BATCH) total += await write(items.slice(i, i + BATCH));
  return total;
}

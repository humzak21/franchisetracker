/**
 * One step of the real NFL history import (docs/NFL-HISTORY.md): fetch an nflverse file, parse
 * it with `shared/history`, write it in batches, then hand back to `importJob.advance`. The CSV
 * reader streams, so even `players.csv` (7 MB, 24k rows) parses in about 11 MB.
 */
import { v } from "convex/values";
import {
  importYears,
  NFLVERSE_FIRST_YEAR,
  NFLVERSE_URLS,
  parsePlayoffs,
  parseStandings,
} from "../../shared/history/nflverse";
import {
  parseDraftPicks,
  parsePlayers,
  parseRoster,
  type ImportedRosterRow,
} from "../../shared/history/nflversePlayers";
import { parseSeasonStats } from "../../shared/history/nflverseStats";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { internalAction, type ActionCtx } from "../_generated/server";
import { cacheHeadshots, cacheTeamLogos } from "../external/media";

const FETCH_TIMEOUT_MS = 120_000;
const BATCH = 250;
/** Career pages per action run; the step continues in a fresh run after this many. */
const CAREER_PAGES_PER_RUN = 12;
const CAREER_PAGE = 150;

type Job = { startYear: number; userTeamId: Id<"teams">; firstYear: number | null };
type StepArgs = { franchiseId: Id<"franchises">; step: string; cursor?: string };
type Counts = {
  seasons?: number;
  players?: number;
  statRows?: number;
  draftPicks?: number;
  rosterEntries?: number;
};
type StepResult = {
  counts: Counts;
  plan?: string[];
  firstYear?: number;
  lastYear?: number;
  continueCursor?: string;
};

/** A file's text, or null when it is not published (404), e.g. a season's postseason file. */
async function fetchOptional(url: string): Promise<string | null> {
  const res = await fetch(url, { signal: AbortSignal.timeout(FETCH_TIMEOUT_MS) });
  if (res.status === 404) return null;
  if (!res.ok) throw new Error(`nflverse returned ${res.status} for ${url}`);
  return await res.text();
}

async function fetchText(url: string): Promise<string> {
  const text = await fetchOptional(url);
  if (text === null) throw new Error(`nflverse has no ${url}`);
  return text;
}

async function batches<T>(items: readonly T[], write: (batch: T[]) => Promise<number>): Promise<number> {
  let total = 0;
  for (let i = 0; i < items.length; i += BATCH) total += await write(items.slice(i, i + BATCH));
  return total;
}

/** Rosters for the franchise's first season, or the latest published season before it. */
async function startRoster(startYear: number): Promise<ImportedRosterRow[]> {
  for (const year of [startYear, startYear - 1]) {
    const text = await fetchOptional(NFLVERSE_URLS.roster(year));
    if (text) return parseRoster(text);
  }
  return [];
}

async function seasons(ctx: ActionCtx, { franchiseId }: StepArgs, job: Job): Promise<StepResult> {
  const [standingsCsv, gamesCsv] = await Promise.all([
    fetchText(NFLVERSE_URLS.standings),
    fetchText(NFLVERSE_URLS.games),
  ]);
  const playoffs = parsePlayoffs(gamesCsv);
  const years = importYears(job.startYear, playoffs);
  const standings = parseStandings(standingsCsv, playoffs).filter((s) => years.includes(s.year));
  let written = 0;
  for (let i = 0; i < years.length; i += 4) {
    const chunk = new Set(years.slice(i, i + 4));
    written += await ctx.runMutation(internal.history.importSeasons.writeSeasons, {
      franchiseId,
      standings: standings.filter((s) => chunk.has(s.year)),
    });
  }
  // A franchise starting before the covered era gets logos and nothing else.
  const plan =
    years.length === 0
      ? ["seasons", "media"]
      : ["seasons", "players", ...years.map((y) => `stats:${y}`), "draft", "rosters", "careers", "media"];
  return { counts: { seasons: written }, plan, firstYear: years[0], lastYear: years.at(-1) };
}

async function players(ctx: ActionCtx, { franchiseId }: StepArgs, job: Job): Promise<StepResult> {
  const firstYear = job.firstYear ?? NFLVERSE_FIRST_YEAR;
  const roster = await startRoster(job.startYear);
  const active = new Set(roster.map((r) => r.player.nflverseId));
  const listed = parsePlayers(
    await fetchText(NFLVERSE_URLS.players),
    (p) => active.has(p.nflverseId) || (p.lastSeason ?? 0) >= firstYear,
  );
  const known = new Set(listed.map((p) => p.nflverseId));
  const all = [...listed, ...roster.map((r) => r.player).filter((p) => !known.has(p.nflverseId))].map(
    (p) => ({
      ...p,
      active: active.has(p.nflverseId),
    }),
  );
  const count = await batches(all, (batch) =>
    ctx.runMutation(internal.history.importPlayers.upsertPlayers, { franchiseId, players: batch }),
  );
  return { counts: { players: count } };
}

async function stats(ctx: ActionCtx, { franchiseId, step }: StepArgs): Promise<StepResult> {
  const year = Number(step.slice("stats:".length));
  let count = 0;
  for (const split of ["regular", "postseason"] as const) {
    const url = NFLVERSE_URLS.seasonStats(year, split);
    const text = split === "postseason" ? await fetchOptional(url) : await fetchText(url);
    if (!text) continue;
    count += await batches(parseSeasonStats(text), (rows) =>
      ctx.runMutation(internal.history.importStats.upsertSeasonStats, { franchiseId, year, split, rows }),
    );
  }
  return { counts: { statRows: count } };
}

async function draft(ctx: ActionCtx, { franchiseId }: StepArgs, job: Job): Promise<StepResult> {
  const years = new Set<number>();
  // The franchise's first draft happened before its first season, so it is history too.
  for (let y = job.firstYear ?? NFLVERSE_FIRST_YEAR; y <= job.startYear; y++) years.add(y);
  const picks = parseDraftPicks(await fetchText(NFLVERSE_URLS.draftPicks), years);
  const count = await batches(picks, (batch) =>
    ctx.runMutation(internal.history.importStats.upsertDraftPicks, { franchiseId, picks: batch }),
  );
  return { counts: { draftPicks: count } };
}

async function rosters(ctx: ActionCtx, { franchiseId }: StepArgs, job: Job): Promise<StepResult> {
  const entries = (await startRoster(job.startYear)).map((r) => ({
    nflverseId: r.player.nflverseId,
    teamAbbr: r.teamAbbr,
    position: r.position,
    jersey: r.jersey,
    exp: r.exp,
    status: r.status,
    drafted: r.drafted,
  }));
  const count = await batches(entries, (batch) =>
    ctx.runMutation(internal.history.importPlayers.upsertRosterEntries, { franchiseId, entries: batch }),
  );
  return { counts: { rosterEntries: count } };
}

async function careers(ctx: ActionCtx, { franchiseId, cursor }: StepArgs): Promise<StepResult> {
  let next: string | null = cursor ?? null;
  for (let page = 0; page < CAREER_PAGES_PER_RUN; page++) {
    const result = await ctx.runMutation(internal.history.importStats.recomputeCareers, {
      franchiseId,
      paginationOpts: { numItems: CAREER_PAGE, cursor: next },
    });
    if (result.isDone) return { counts: {} };
    next = result.continueCursor;
  }
  return { counts: {}, continueCursor: next ?? undefined };
}

async function media(ctx: ActionCtx, { franchiseId }: StepArgs): Promise<StepResult> {
  // Faces and logos are nice to have: ESPN being down must not fail the history import.
  try {
    await cacheTeamLogos(ctx);
    const pending = await ctx.runQuery(internal.players.headshots.pendingForFranchise, { franchiseId });
    await cacheHeadshots(ctx, pending);
  } catch (error) {
    console.warn("ESPN media caching skipped:", error);
  }
  return { counts: {} };
}

function stepFn(step: string) {
  if (step.startsWith("stats:")) return stats;
  const steps = { seasons, players, draft, rosters, careers, media } as const;
  const fn = steps[step as keyof typeof steps];
  if (!fn) throw new Error(`Unknown import step "${step}"`);
  return fn;
}

export const runStep = internalAction({
  args: {
    franchiseId: v.id("franchises"),
    run: v.number(),
    step: v.string(),
    cursor: v.optional(v.string()),
  },
  returns: v.null(),
  handler: async (ctx, { franchiseId, run, step, cursor }) => {
    const job = await ctx.runQuery(internal.history.importJob.context, { franchiseId });
    if (!job || job.run !== run || !job.running) return null;
    try {
      const result = await stepFn(step)(ctx, { franchiseId, step, cursor }, job);
      await ctx.runMutation(internal.history.importJob.advance, { franchiseId, run, ...result });
    } catch (error) {
      const message = error instanceof Error ? error.message : "Import failed";
      await ctx.runMutation(internal.history.importJob.fail, {
        franchiseId,
        run,
        error: `${step}: ${message}`,
      });
    }
    return null;
  },
});

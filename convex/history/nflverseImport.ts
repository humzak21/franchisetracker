/**
 * One step of the real NFL history import (docs/NFL-HISTORY.md): fetch an nflverse file, parse
 * it with `shared/history`, write it in batches, then hand back to `importJob.advance`. The CSV
 * reader streams, so even `players.csv` (7 MB, 24k rows) parses in about 11 MB. Steps with a
 * year range ("players:1999-2001") belong to the earlier-years import (`shared/history/importPlan`).
 */
import { v } from "convex/values";
import { inRange, parseRange, splitStep } from "../../shared/history/importPlan";
import { NFLVERSE_FIRST_YEAR, NFLVERSE_URLS } from "../../shared/history/nflverse";
import {
  parseDraftPicks,
  parsePlayers,
  parseRoster,
  type ImportedPlayer,
  type ImportedRosterRow,
} from "../../shared/history/nflversePlayers";
import { parseSeasonStats } from "../../shared/history/nflverseStats";
import { internal } from "../_generated/api";
import { internalAction, type ActionCtx } from "../_generated/server";
import { cacheHeadshots, cacheTeamLogos } from "../external/media";
import { batches, fetchOptional, fetchText, type Job, type StepArgs, type StepResult } from "./importStep";
import { seasons } from "./seasonsStep";

/** Career pages per action run; the step continues in a fresh run after this many. */
const CAREER_PAGES_PER_RUN = 12;
const CAREER_PAGE = 150;

/** Rosters for the franchise's first season, or the latest published season before it. */
async function startRoster(startYear: number): Promise<ImportedRosterRow[]> {
  for (const year of [startYear, startYear - 1]) {
    const text = await fetchOptional(NFLVERSE_URLS.roster(year));
    if (text) return parseRoster(text);
  }
  return [];
}

/** Everyone whose last season is covered, plus the first-season rosters. */
async function everyPlayer(job: Job): Promise<(ImportedPlayer & { active: boolean })[]> {
  const firstYear = job.firstYear ?? NFLVERSE_FIRST_YEAR;
  const roster = await startRoster(job.startYear);
  const active = new Set(roster.map((r) => r.player.nflverseId));
  const listed = parsePlayers(
    await fetchText(NFLVERSE_URLS.players),
    (p) => active.has(p.nflverseId) || (p.lastSeason ?? 0) >= firstYear,
  );
  const known = new Set(listed.map((p) => p.nflverseId));
  return [...listed, ...roster.map((r) => r.player).filter((p) => !known.has(p.nflverseId))].map((p) => ({
    ...p,
    active: active.has(p.nflverseId),
  }));
}

async function players(ctx: ActionCtx, { franchiseId, step }: StepArgs, job: Job): Promise<StepResult> {
  const range = parseRange(splitStep(step)[1]);
  // The earlier-years import adds only players whose careers ended in its seasons: all retired.
  const all = range
    ? parsePlayers(await fetchText(NFLVERSE_URLS.players), (p) => inRange(p.lastSeason ?? 0, range)).map(
        (p) => ({ ...p, active: false }),
      )
    : await everyPlayer(job);
  const count = await batches(all, (batch) =>
    ctx.runMutation(internal.history.importPlayers.upsertPlayers, { franchiseId, players: batch }),
  );
  return { counts: { players: count } };
}

async function stats(ctx: ActionCtx, { franchiseId, step }: StepArgs): Promise<StepResult> {
  const year = Number(splitStep(step)[1]);
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

async function draft(ctx: ActionCtx, { franchiseId, step }: StepArgs, job: Job): Promise<StepResult> {
  // The franchise's first draft happened before its first season, so it is history too.
  const range = parseRange(splitStep(step)[1]) ?? {
    from: job.firstYear ?? NFLVERSE_FIRST_YEAR,
    to: job.startYear,
  };
  const years = new Set<number>();
  for (let y = range.from; y <= range.to; y++) years.add(y);
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

const STEPS = { seasons, players, stats, draft, rosters, careers, media } as const;

function stepFn(step: string) {
  const name = splitStep(step)[0];
  if (!Object.hasOwn(STEPS, name)) throw new Error(`Unknown import step "${step}"`);
  return STEPS[name as keyof typeof STEPS];
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

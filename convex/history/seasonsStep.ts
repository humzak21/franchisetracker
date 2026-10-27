/**
 * The import's first step: which seasons are finished, their standings and the plan for the
 * rest. Standings come from nfldata's file from 2002 and are derived from the schedule before it
 * (`shared/history/eraStandings.ts`). With a year range ("seasons:1999-2001") it is the first
 * step of the earlier-years import and plans only what those seasons need.
 */
import { deriveStandings } from "../../shared/history/eraStandings";
import { earlierPlan, fullPlan, inRange, parseRange, splitStep } from "../../shared/history/importPlan";
import {
  importYears,
  NFLVERSE_URLS,
  parseStandings,
  playoffsFromGames,
  STANDINGS_FILE_FIRST_YEAR,
  type ImportedStanding,
  type PlayoffResults,
} from "../../shared/history/nflverse";
import { parseGames, type PlayedGame } from "../../shared/history/nflverseGames";
import { internal } from "../_generated/api";
import type { ActionCtx } from "../_generated/server";
import { fetchText, type Job, type StepArgs, type StepResult } from "./importStep";

/** Seasons written per mutation. */
const YEARS_PER_WRITE = 4;

async function standingsFor(
  years: readonly number[],
  games: readonly PlayedGame[],
  playoffs: PlayoffResults,
): Promise<ImportedStanding[]> {
  const derived = years
    .filter((y) => y < STANDINGS_FILE_FIRST_YEAR)
    .flatMap((y) => deriveStandings(y, games, playoffs.get(y)));
  const fromFile = years.filter((y) => y >= STANDINGS_FILE_FIRST_YEAR);
  if (fromFile.length === 0) return derived;
  const file = parseStandings(await fetchText(NFLVERSE_URLS.standings), playoffs);
  return [...derived, ...file.filter((s) => fromFile.includes(s.year))];
}

export async function seasons(
  ctx: ActionCtx,
  { franchiseId, step }: StepArgs,
  job: Job,
): Promise<StepResult> {
  const range = parseRange(splitStep(step)[1]);
  const games = parseGames(await fetchText(NFLVERSE_URLS.games));
  const playoffs = playoffsFromGames(games);
  const years = importYears(job.startYear, playoffs).filter((y) => inRange(y, range));
  const standings = await standingsFor(years, games, playoffs);
  let written = 0;
  for (let i = 0; i < years.length; i += YEARS_PER_WRITE) {
    const chunk = new Set(years.slice(i, i + YEARS_PER_WRITE));
    written += await ctx.runMutation(internal.history.importSeasons.writeSeasons, {
      franchiseId,
      standings: standings.filter((s) => chunk.has(s.year)),
    });
  }
  const counts = { seasons: written };
  // The earlier-years import moves the first year back and leaves the last one alone.
  if (range) return { counts, plan: earlierPlan(range, years), firstYear: years[0] };
  return { counts, plan: fullPlan(years), firstYear: years[0], lastYear: years.at(-1) };
}

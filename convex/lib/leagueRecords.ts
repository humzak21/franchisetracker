/**
 * Other teams' records from the scores the franchise knows: every league game from the schedule
 * screen plus the user team's own games. Run after anything that changes a score, so a team's
 * standings row keeps up with its games (`shared/league/records.ts`). Once every team has played
 * its regular season, worked-out rows also get their division rank and seed, and their playoff
 * result as the playoff scores come in (`shared/league/projection.ts`).
 */
import { alignmentFor } from "../../shared/league/alignment";
import { seasonBoard } from "../../shared/league/projection";
import { gamesIn, recordsFromGames, shouldReplaceRecord, type ScoredGame } from "../../shared/league/records";
import type { StandingRow } from "../../shared/league/standings";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { must } from "./errors";
import { teamsById } from "./franchise";
import { seasonGames } from "./reports";
import { seasonScores } from "./seasonScores";

/** A full season of league games with the playoffs, with headroom. */
const MAX_LEAGUE_GAMES = 400;
const MAX_TEAMS = 64;

export async function refreshLeagueRecords(ctx: MutationCtx, seasonId: Id<"seasons">): Promise<void> {
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  const franchise = must(await ctx.db.get("franchises", season.franchiseId), "Franchise");
  // Real NFL seasons before the franchise keep their imported standings untouched.
  if (season.year < franchise.startYear) return;

  const [league, own, rows] = await Promise.all([
    ctx.db
      .query("leagueGames")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_LEAGUE_GAMES),
    seasonGames(ctx, seasonId),
    ctx.db
      .query("standings")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId))
      .take(MAX_TEAMS),
  ]);
  const games: ScoredGame[] = [
    ...league,
    // The user team's games come last: their box score is the more trusted score of the two.
    ...own.flatMap((g) =>
      g.homeTeamId && g.awayTeamId ? [{ ...g, homeTeamId: g.homeTeamId, awayTeamId: g.awayTeamId }] : [],
    ),
  ];
  const records = recordsFromGames(games);

  const stored = new Map(rows.map((r) => [r.teamId as string, r]));
  for (const [teamId, record] of records) {
    // The user team's record is its season's, kept by `refreshSeasonRecord`.
    if (teamId === franchise.userTeamId) continue;
    const row = stored.get(teamId);
    if (!shouldReplaceRecord(row ? { ...row, derived: row.source === "derived" } : null, record)) continue;
    const fields = { ...record, source: row && row.source !== "derived" ? row.source : ("derived" as const) };
    if (row) await ctx.db.patch("standings", row._id, fields);
    else {
      await ctx.db.insert("standings", {
        franchiseId: franchise._id,
        seasonId,
        teamId: teamId as Id<"teams">,
        ...fields,
      });
    }
  }
  // A worked-out row whose games are all gone (a game deleted or re-read as another matchup) goes too.
  for (const row of rows) {
    if (row.source === "derived" && !records.has(row.teamId)) await ctx.db.delete("standings", row._id);
  }
  await settleSeason(ctx, season, franchise);
}

/**
 * Division ranks, seeds and playoff results for worked-out rows once the field is set; cleared
 * again while it is not. Captured and imported rows keep what their screen printed, and the
 * user team's season only gains a rank or seed it did not have.
 */
async function settleSeason(ctx: MutationCtx, season: Doc<"seasons">, franchise: Doc<"franchises">) {
  const teams = await teamsById(ctx);
  const [stored, scores] = await Promise.all([
    ctx.db
      .query("standings")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id))
      .take(MAX_TEAMS),
    seasonScores(ctx, season._id, teams),
  ]);
  const toRow = (team: Doc<"teams">, r: Omit<StandingRow, "teamAbbr" | "conference" | "division">) => ({
    ...r,
    teamAbbr: team.abbr,
    ...alignmentFor(season.year, team),
  });
  const rows: (StandingRow & { doc?: Doc<"standings"> })[] = stored.flatMap((r) => {
    const team = teams.get(r.teamId);
    return team ? [{ ...toRow(team, r), doc: r }] : [];
  });
  const userTeam = teams.get(franchise.userTeamId);
  const own = season.userRecord;
  const ownRow = rows.find((r) => r.doc?.teamId === franchise.userTeamId);
  if (userTeam && own && !ownRow) rows.push(toRow(userTeam, own));
  // The user team's games are the truth for its record, as on the League page.
  if (ownRow && own && gamesIn(own) > gamesIn(ownRow))
    Object.assign(ownRow, { w: own.w, l: own.l, t: own.t });
  const { projection, results } = seasonBoard(season.year, rows, scores);

  for (const row of rows) {
    const p = projection.rows.get(row.teamAbbr);
    if (!row.doc || row.doc.source !== "derived" || !p) continue;
    const next = projection.final
      ? {
          divisionRank: p.divisionRank,
          seed: p.seed ?? undefined,
          playoffResult: results.get(row.teamAbbr) ?? (p.seed === null ? ("missed" as const) : undefined),
        }
      : { divisionRank: undefined, seed: undefined, playoffResult: undefined };
    const { divisionRank, seed, playoffResult } = row.doc;
    if (divisionRank !== next.divisionRank || seed !== next.seed || playoffResult !== next.playoffResult) {
      await ctx.db.patch("standings", row.doc._id, next);
    }
  }

  const mine = userTeam && projection.rows.get(userTeam.abbr);
  if (!projection.final || !own || !mine) return;
  const divisionRank = own.divisionRank ?? mine.divisionRank;
  const seed = own.seed ?? mine.seed ?? undefined;
  if (divisionRank !== own.divisionRank || seed !== own.seed) {
    await ctx.db.patch("seasons", season._id, { userRecord: { ...own, divisionRank, seed } });
  }
}

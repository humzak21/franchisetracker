/**
 * The sample franchise's real NFL history: a slice of genuine nflverse files run through the
 * same parsers and import writes as the real import, so tests and CI exercise that path offline.
 */
import { importYears, parsePlayoffs, parseStandings } from "../../shared/history/nflverse";
import { NFLVERSE_SAMPLE } from "../../shared/history/nflverseSample";
import { parseDraftPicks, parsePlayers, parseRoster } from "../../shared/history/nflversePlayers";
import { parseSeasonStats } from "../../shared/history/nflverseStats";
import type { Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { upsertPlayerRows, upsertRosterRows } from "../history/importPlayers";
import { writeSeasonRows } from "../history/importSeasons";
import { upsertDraftRows, upsertStatRows } from "../history/importStats";

export async function seedSampleHistory(ctx: MutationCtx, franchiseId: Id<"franchises">, startYear: number) {
  const playoffs = parsePlayoffs(NFLVERSE_SAMPLE.playoffGames);
  const years = importYears(startYear, playoffs);
  const seasons = await writeSeasonRows(
    ctx,
    franchiseId,
    parseStandings(NFLVERSE_SAMPLE.standings, playoffs),
  );

  const roster = parseRoster(NFLVERSE_SAMPLE.roster2026);
  const active = new Set(roster.map((r) => r.player.nflverseId));
  const players = parsePlayers(NFLVERSE_SAMPLE.players, () => true).map((p) => ({
    ...p,
    active: active.has(p.nflverseId),
  }));
  await upsertPlayerRows(ctx, franchiseId, players);

  let statRows = 0;
  for (const [year, files] of Object.entries(NFLVERSE_SAMPLE.seasonStats)) {
    for (const split of ["regular", "postseason"] as const) {
      const rows = parseSeasonStats(files[split]);
      statRows += await upsertStatRows(ctx, { franchiseId, year: Number(year), split, rows });
    }
  }
  const draftYears = new Set([...years, startYear]);
  const draftPicks = await upsertDraftRows(
    ctx,
    franchiseId,
    parseDraftPicks(NFLVERSE_SAMPLE.draftPicks, draftYears),
  );
  const rosterEntries = await upsertRosterRows(
    ctx,
    franchiseId,
    roster.map((r) => ({
      nflverseId: r.player.nflverseId,
      teamAbbr: r.teamAbbr,
      position: r.position,
      jersey: r.jersey,
      exp: r.exp,
      status: r.status,
      drafted: r.drafted,
    })),
  );

  const now = Date.now();
  await ctx.db.insert("historyImports", {
    franchiseId,
    run: 1,
    status: "done",
    plan: ["seasons", "players", ...years.map((y) => `stats:${y}`), "draft", "rosters", "careers"],
    stepsDone: years.length + 5,
    firstYear: years[0],
    lastYear: years.at(-1),
    counts: { seasons, players: players.length, statRows, draftPicks, rosterEntries },
    startedAt: now,
    finishedAt: now,
  });
}

/**
 * Commits for the season number screens: season stats, league leaders, team season stats, league
 * team stats, standings.
 */
import { isRawStatKey } from "../../shared/stats";
import { isLeagueTeamRawKey } from "../../shared/stats/leagueTeamRegistry";
import { isTeamSeasonStatKey } from "../../shared/stats/teamSeasonRegistry";
import type { MutationCtx } from "../_generated/server";
import { invalid } from "../lib/errors";
import { numberOf, rowPlayer, teamCache, textOf, type RowCommit, type RowCommitResult } from "./rowCommit";

/** A league's worth of rows per stat and season, with headroom. */
const MAX_ROWS = 400;

/**
 * Season stats are a check, never a source: they land in `reportedSeasonStats` for the
 * reconciliation view (the user's team) and League stats (everyone). A stat whose reported value changed loses the way its difference was settled.
 */
export async function commitSeasonStats(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  const shown = typeof commit.meta.team === "string" ? commit.meta.team : null;
  for (const row of commit.rows) {
    // The row's team, else the team the screen shows. Never the user's team by default: another
    // team's season stats belong in League stats, not on our roster.
    const abbr = row.teamAbbr ?? shown;
    if (!abbr) throw invalid(`${row.name ?? "A row"}: pick the team`);
    const teamId = (await team(abbr))._id;
    const player = await rowPlayer(ctx, commit, row, teamId);
    const stats = Object.fromEntries(
      Object.entries(row.values).filter(
        (e): e is [string, number] => isRawStatKey(e[0]) && typeof e[1] === "number",
      ),
    );
    const gamesPlayed = numberOf(row, "gamesPlayed");
    const existing = (
      await ctx.db
        .query("reportedSeasonStats")
        .withIndex("by_playerId_and_seasonId", (q) =>
          q.eq("playerId", player._id).eq("seasonId", commit.season._id),
        )
        .take(10)
    ).find((r) => r.teamId === teamId);
    if (!existing) {
      await ctx.db.insert("reportedSeasonStats", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        playerId: player._id,
        teamId,
        gamesPlayed,
        stats,
      });
      continue;
    }
    const merged = { ...existing.stats, ...stats };
    const games = gamesPlayed ?? existing.gamesPlayed;
    const resolved = Object.fromEntries(
      Object.entries(existing.resolved ?? {}).filter(([key]) =>
        key === "gamesPlayed" ? games === existing.gamesPlayed : merged[key] === existing.stats[key],
      ),
    );
    await ctx.db.patch("reportedSeasonStats", existing._id, { stats: merged, gamesPlayed: games, resolved });
  }
  return {};
}

/** Replaces the season's board for the stat with the accepted rows. */
export async function commitLeagueLeaders(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const statKey = typeof commit.meta.stat === "string" ? commit.meta.stat : null;
  if (!statKey) throw invalid("Pick which stat the board ranks");
  const old = await ctx.db
    .query("leagueLeaders")
    .withIndex("by_seasonId_and_statKey_and_rank", (q) =>
      q.eq("seasonId", commit.season._id).eq("statKey", statKey),
    )
    .take(MAX_ROWS);
  for (const row of old) await ctx.db.delete("leagueLeaders", row._id);
  const team = teamCache(ctx);
  const values = commit.rows.map((r) => numberOf(r, "value"));
  for (const [i, row] of commit.rows.entries()) {
    const teamId = row.teamAbbr ? (await team(row.teamAbbr))._id : undefined;
    const player = row.name || row.playerId ? await rowPlayer(ctx, commit, row, teamId) : null;
    const value = values[i] ?? 0;
    await ctx.db.insert("leagueLeaders", {
      franchiseId: commit.franchise._id,
      seasonId: commit.season._id,
      statKey,
      rank: numberOf(row, "rank") ?? i + 1,
      tied: values.filter((v) => v === value).length > 1,
      playerId: player?._id,
      rawName: row.name ?? undefined,
      teamId,
      value,
    });
  }
  return {};
}

export async function commitTeamSeasonStats(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const abbr = typeof commit.meta.team === "string" ? commit.meta.team : null;
  if (!abbr) throw invalid("Pick whose stats these are");
  const team = await teamCache(ctx)(abbr);
  for (const row of commit.rows) {
    const statKey = textOf(row, "stat");
    const value = numberOf(row, "value");
    if (!statKey || !isTeamSeasonStatKey(statKey) || value === undefined) continue;
    const fields = { value, rank: numberOf(row, "rank"), tied: row.values.tied === true };
    const existing = await ctx.db
      .query("teamSeasonStats")
      .withIndex("by_seasonId_and_teamId_and_statKey", (q) =>
        q.eq("seasonId", commit.season._id).eq("teamId", team._id).eq("statKey", statKey),
      )
      .unique();
    if (existing) await ctx.db.patch("teamSeasonStats", existing._id, fields);
    else {
      await ctx.db.insert("teamSeasonStats", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        teamId: team._id,
        statKey,
        ...fields,
      });
    }
  }
  return {};
}

/** Merges each team's numbers into its season row; a tab captured again replaces its own values. */
export async function commitLeagueTeamStats(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    if (!row.teamAbbr) continue;
    const teamId = (await team(row.teamAbbr))._id;
    const stats = Object.fromEntries(
      Object.entries(row.values).filter(
        (e): e is [string, number] => isLeagueTeamRawKey(e[0]) && typeof e[1] === "number",
      ),
    );
    const existing = await ctx.db
      .query("leagueTeamStats")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", commit.season._id).eq("teamId", teamId))
      .unique();
    if (existing)
      await ctx.db.patch("leagueTeamStats", existing._id, { stats: { ...existing.stats, ...stats } });
    else {
      await ctx.db.insert("leagueTeamStats", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        teamId,
        stats,
      });
    }
  }
  return {};
}

/**
 * Upserts each team's standing. The user team's division finish and seed also go onto the
 * season (the decade grid and the trophy room read them); its record stays the one from games.
 */
export async function commitStandings(ctx: MutationCtx, commit: RowCommit): Promise<RowCommitResult> {
  const team = teamCache(ctx);
  for (const row of commit.rows) {
    if (!row.teamAbbr) continue;
    const t = await team(row.teamAbbr);
    const fields = {
      w: numberOf(row, "w") ?? 0,
      l: numberOf(row, "l") ?? 0,
      t: numberOf(row, "t") ?? 0,
      divisionRank: numberOf(row, "divisionRank"),
      seed: numberOf(row, "seed"),
      pointsFor: numberOf(row, "pointsFor"),
      pointsAgainst: numberOf(row, "pointsAgainst"),
      source: "import" as const,
    };
    const existing = await ctx.db
      .query("standings")
      .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", commit.season._id).eq("teamId", t._id))
      .unique();
    if (existing) await ctx.db.patch("standings", existing._id, fields);
    else {
      await ctx.db.insert("standings", {
        franchiseId: commit.franchise._id,
        seasonId: commit.season._id,
        teamId: t._id,
        ...fields,
      });
    }
    if (t._id === commit.franchise.userTeamId) {
      const record = commit.season.userRecord ?? { w: fields.w, l: fields.l, t: fields.t };
      await ctx.db.patch("seasons", commit.season._id, {
        userRecord: {
          ...record,
          ...(fields.divisionRank !== undefined ? { divisionRank: fields.divisionRank } : {}),
          ...(fields.seed !== undefined ? { seed: fields.seed } : {}),
        },
      });
    }
  }
  return {};
}

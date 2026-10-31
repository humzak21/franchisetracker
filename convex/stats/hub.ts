/**
 * The Stats overview and the countdowns (`docs/STATS-HUB.md` 3 and 6): one season's headline
 * numbers, who leads it, what it set, and which career marks the roster is closing in on.
 */
import { v } from "convex/values";
import { seasonSummary, userScore } from "../../shared/games/summary";
import { countdowns, regularPoints, seasonInProgress, seasonLeaders } from "../../shared/stats/hub";
import { preferLogs, type StatLine } from "../../shared/stats";
import { onRoster } from "../../shared/roster/averages";
import type { Doc } from "../_generated/dataModel";
import { query } from "../_generated/server";
import { vWlt } from "../games/validators";
import { requireOwner } from "../lib/auth";
import { activeFranchise, MAX_ROSTER, playersById } from "../lib/franchise";
import { headshotUrls } from "../lib/refs";
import { seasonGames } from "../lib/reports";
import { vMilestoneKind, vPosition, vWeekKey } from "../lib/validators";

const MAX_ROWS = 300;
/** A season's milestones, every kind; the ones a season "set" are picked out of them. */
const MAX_MILESTONES = 400;
const RECORDS_SHOWN = 8;
const COUNTDOWNS_SHOWN = 6;

const SET_KINDS: readonly Doc<"milestones">["kind"][] = ["franchise_record", "team_record", "mark"];

const vPlayerRef = v.object({
  playerId: v.id("players"),
  name: v.string(),
  position: vPosition,
  headshotUrl: v.union(v.string(), v.null()),
});

export const overview = query({
  args: { seasonId: v.id("seasons") },
  returns: v.union(
    v.null(),
    v.object({
      gamesPerSeason: v.number(),
      inProgress: v.boolean(),
      played: v.number(),
      record: vWlt,
      pointsFor: v.number(),
      pointsAgainst: v.number(),
      leaders: v.array(
        v.object({
          key: v.string(),
          label: v.string(),
          stat: v.string(),
          value: v.number(),
          gamesPlayed: v.number(),
          player: vPlayerRef,
        }),
      ),
      setThisSeason: v.array(
        v.object({
          _id: v.id("milestones"),
          title: v.string(),
          detail: v.union(v.string(), v.null()),
          weekKey: v.union(vWeekKey, v.null()),
          kind: vMilestoneKind,
          playerId: v.union(v.id("players"), v.null()),
        }),
      ),
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (!season || season.franchiseId !== franchise._id) return null;
    const { gamesPerSeason } = franchise.settings;

    const games = await seasonGames(ctx, seasonId);
    const { regular } = seasonSummary(games);
    const played = regular.w + regular.l + regular.t;
    const stored = season.userRecord;
    const record = played === 0 && stored ? { w: stored.w, l: stored.l, t: stored.t } : regular;
    const points = regularPoints(
      games.flatMap((game) => {
        const score = userScore(game);
        return score ? [{ weekKey: game.weekKey, pointsFor: score.us, pointsAgainst: score.them }] : [];
      }),
    );

    const rows = await ctx.db
      .query("seasonPlayerStats")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROWS);
    // One row per player, logs over imported totals: keyed on the player, not the team.
    const shown = preferLogs(
      rows
        .filter((row) => row.split === "regular")
        .map((row) => ({ ...row, year: season.year, teamKey: row.playerId })),
    );
    const leaders = seasonLeaders(shown.map((row) => ({ ...row, totals: row.totals as StatLine })));
    const players = await playersById(
      ctx,
      leaders.map((l) => l.row.playerId),
    );
    const photos = await headshotUrls(ctx, players.values());

    const milestones = await ctx.db
      .query("milestones")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .order("desc")
      .take(MAX_MILESTONES);

    return {
      gamesPerSeason,
      inProgress: seasonInProgress(season.status, played, gamesPerSeason),
      played,
      record,
      ...points,
      leaders: leaders.flatMap(({ key, label, stat, value, row }) => {
        const player = players.get(row.playerId);
        if (!player) return [];
        return [
          {
            key,
            label,
            stat,
            value,
            gamesPlayed: row.gamesPlayed,
            player: {
              playerId: player._id,
              name: player.displayName,
              position: row.position ?? player.position,
              headshotUrl: photos.get(player._id) ?? null,
            },
          },
        ];
      }),
      setThisSeason: milestones
        .filter((m) => SET_KINDS.includes(m.kind))
        .slice(0, RECORDS_SHOWN)
        .map((m) => ({
          _id: m._id,
          title: m.title,
          detail: m.detail ?? null,
          weekKey: m.weekKey ?? null,
          kind: m.kind,
          playerId: m.playerId ?? null,
        })),
    };
  },
});

/** The career marks the season's roster is nearest to, for Home and the Overview. */
export const countdownsFor = query({
  args: { seasonId: v.id("seasons") },
  returns: v.array(
    v.object({
      statKey: v.string(),
      mark: v.number(),
      value: v.number(),
      remaining: v.number(),
      gamesAway: v.number(),
      player: vPlayerRef,
    }),
  ),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    if (season?.franchiseId !== franchise._id) return [];
    const entries = await ctx.db
      .query("rosterEntries")
      .withIndex("by_seasonId_and_teamId", (q) =>
        q.eq("seasonId", seasonId).eq("teamId", franchise.userTeamId),
      )
      .take(MAX_ROSTER);
    const rostered = entries.filter((e) => onRoster(e.status));
    const careers = await Promise.all(
      rostered.map(async (entry) => {
        const rows = await ctx.db
          .query("careerPlayerStats")
          .withIndex("by_playerId", (q) => q.eq("playerId", entry.playerId))
          .take(2);
        const career = rows.find((r) => r.split === "regular");
        return career
          ? [{ id: entry.playerId, games: career.gamesPlayed, totals: career.totals as StatLine }]
          : [];
      }),
    );
    const nearest = countdowns(careers.flat(), franchise.settings.gamesPerSeason).slice(0, COUNTDOWNS_SHOWN);
    const players = await playersById(
      ctx,
      nearest.map((c) => c.id),
    );
    const photos = await headshotUrls(ctx, players.values());
    const positions = new Map(rostered.map((e) => [e.playerId, e.position]));
    return nearest.flatMap(({ id, statKey, mark, value, remaining, gamesAway }) => {
      const player = players.get(id);
      if (!player) return [];
      return [
        {
          statKey,
          mark,
          value,
          remaining,
          gamesAway,
          player: {
            playerId: id,
            name: player.displayName,
            position: positions.get(id) ?? player.position,
            headshotUrl: photos.get(id) ?? null,
          },
        },
      ];
    });
  },
});

/** Who the printed names in a box score might be: the extraction action's roster lookup. */
import { v, type Infer } from "convex/values";
import { onRoster } from "../../shared/roster/averages";
import { nameTokens } from "../../shared/ingestion/nameMatch";
import type { Doc, Id } from "../_generated/dataModel";
import { internalQuery, type QueryCtx } from "../_generated/server";
import { activeFranchise, MAX_ROSTER, playersById, teamsById } from "../lib/franchise";
import { searchPlayers } from "../players/nameSearch";
import { leagueSeason, seasonPlace } from "./rosterContext";

const SEARCH_HITS = 8;
const MAX_NAMES = 120;
/** A draft class and whoever else first appeared that season, misreads and retakes included. */
const MAX_DRAFT_POOL = 600;

const vCandidate = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  aliases: v.array(v.string()),
  teamAbbr: v.union(v.string(), v.null()),
  position: v.union(v.string(), v.null()),
  inactive: v.boolean(),
  inLeague: v.optional(v.boolean()),
  lastTeamAbbr: v.union(v.string(), v.null()),
});

const nameFields = (p: Doc<"players">) => ({
  playerId: p._id,
  displayName: p.displayName,
  firstName: p.firstName,
  lastName: p.lastName,
  aliases: [...p.aliases],
});

/**
 * Players a printed name may refer to: the rosters of the teams given for the season, active
 * players ahead of anyone released or traded away, then a text search across the franchise for
 * each name (traded players, typos in the roster). Every search hit carries where they are this
 * season and last, so a namesake on another team or out of the league ranks behind the player on
 * the team that printed the name. The search skips retired players: 16,000 people in the NFL
 * history are not who a box score means. Anyone on a season's roster stays in the pool, since a
 * retired player still played the seasons they are rostered for.
 */
export const forNames = internalQuery({
  args: {
    seasonId: v.union(v.id("seasons"), v.null()),
    teamAbbrs: v.array(v.string()),
    names: v.array(v.string()),
  },
  returns: v.array(vCandidate),
  handler: async (ctx, { seasonId, teamAbbrs, names }) => {
    const out = new Map<Id<"players">, Infer<typeof vCandidate>>();
    const allTeams = [...(await teamsById(ctx)).values()];
    const teams = allTeams.filter((t) => teamAbbrs.includes(t.abbr));
    const franchise = await activeFranchise(ctx);
    const season = seasonId ? await ctx.db.get("seasons", seasonId) : null;
    const league = season ? await leagueSeason(ctx, season, allTeams) : null;
    if (season) {
      for (const team of teams) {
        const entries = await ctx.db
          .query("rosterEntries")
          .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", season._id).eq("teamId", team._id))
          .take(MAX_ROSTER);
        const players = await playersById(
          ctx,
          entries.map((e) => e.playerId),
        );
        for (const entry of entries) {
          const player = players.get(entry.playerId);
          if (!player) continue;
          const inactive = !onRoster(entry.status);
          // A player traded between these two teams is on the one they still play for.
          if (inactive && out.has(player._id)) continue;
          out.set(player._id, {
            ...nameFields(player),
            teamAbbr: team.abbr,
            position: entry.position,
            inactive,
            inLeague: league?.loaded ? !inactive : undefined,
            lastTeamAbbr: null,
          });
        }
      }
    }
    for (const name of names.slice(0, MAX_NAMES)) {
      const tokens = nameTokens(name);
      const last = tokens.at(-1);
      if (!last) continue;
      // The search prefix-matches its last term, so "walker k" ranks the K. Walkers first.
      const text = tokens.length > 1 ? `${last} ${tokens[0]}` : last;
      const hits = await searchPlayers(ctx, franchise._id, text, SEARCH_HITS, { activeOnly: true });
      for (const p of hits) {
        if (out.has(p._id)) continue;
        const place = league
          ? await seasonPlace(ctx, league, p._id)
          : { teamAbbr: null, inactive: false, inLeague: undefined, lastTeamAbbr: null };
        out.set(p._id, { ...nameFields(p), position: p.position, ...place });
      }
    }
    return [...out.values()];
  },
});

const lookup = (
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  seasonId: Id<"seasons">,
  teamAbbr: string,
  normalizedName: string,
) =>
  ctx.db
    .query("playerNameAssignments")
    .withIndex("by_franchiseId_and_seasonId_and_teamAbbr_and_normalizedName", (q) =>
      q
        .eq("franchiseId", franchiseId)
        .eq("seasonId", seasonId)
        .eq("teamAbbr", teamAbbr)
        .eq("normalizedName", normalizedName),
    )
    .unique();

/** A saved choice from last season still stands, unless this season shows they have left the team. */
async function stillHere(
  ctx: QueryCtx,
  player: Doc<"players">,
  seasonId: Id<"seasons">,
  teamId: Id<"teams"> | undefined,
) {
  if (player.retired) return false;
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", seasonId))
    .take(10);
  return entries.length === 0 || entries.some((e) => e.teamId === teamId && onRoster(e.status));
}

/**
 * Exact saved choices are scoped by franchise, season, and team, including players outside search
 * hits. A name with none this season falls back to the team's choice last season.
 */
export const assignments = internalQuery({
  args: {
    seasonId: v.union(v.id("seasons"), v.null()),
    names: v.array(v.object({ name: v.string(), teamAbbr: v.union(v.string(), v.null()) })),
  },
  returns: v.array(
    v.object({
      normalizedName: v.string(),
      teamAbbr: v.string(),
      playerId: v.id("players"),
      name: v.string(),
      carried: v.boolean(),
    }),
  ),
  handler: async (ctx, { seasonId, names }) => {
    if (!seasonId) return [];
    const franchise = await activeFranchise(ctx);
    const season = await ctx.db.get("seasons", seasonId);
    const last = season
      ? await ctx.db
          .query("seasons")
          .withIndex("by_franchiseId_and_year", (q) =>
            q.eq("franchiseId", franchise._id).eq("year", season.year - 1),
          )
          .unique()
      : null;
    const teams = new Map([...(await teamsById(ctx)).values()].map((t) => [t.abbr, t._id]));
    const out = [];
    for (const row of names.slice(0, MAX_NAMES)) {
      const { teamAbbr } = row;
      if (!teamAbbr) continue;
      const normalizedName = nameTokens(row.name).join(" ");
      const saved = await lookup(ctx, franchise._id, seasonId, teamAbbr, normalizedName);
      const earlier =
        !saved && last ? await lookup(ctx, franchise._id, last._id, teamAbbr, normalizedName) : null;
      const found = saved ?? earlier;
      if (!found) continue;
      const player = await ctx.db.get("players", found.playerId);
      if (player?.franchiseId !== franchise._id) continue;
      if (!saved && !(await stillHere(ctx, player, seasonId, teams.get(teamAbbr)))) continue;
      out.push({
        normalizedName,
        teamAbbr,
        playerId: player._id,
        name: player.displayName,
        carried: !saved,
      });
    }
    return out;
  },
});

const vDraftPoolPlayer = v.object({
  playerId: v.id("players"),
  displayName: v.string(),
  firstName: v.string(),
  lastName: v.string(),
  aliases: v.array(v.string()),
  position: v.string(),
  college: v.union(v.string(), v.null()),
});

const poolPlayer = (p: Doc<"players">) => ({
  playerId: p._id,
  displayName: p.displayName,
  firstName: p.firstName,
  lastName: p.lastName,
  aliases: p.aliases,
  position: p.position,
  college: p.college ?? null,
});

/** Who a draft class can be: the picks committed this season, and everyone created in it. */
export const draftClass = internalQuery({
  args: { seasonId: v.union(v.id("seasons"), v.null()) },
  returns: v.object({
    picks: v.array(v.object({ overall: v.number(), player: vDraftPoolPlayer })),
    pool: v.array(vDraftPoolPlayer),
  }),
  handler: async (ctx, { seasonId }) => {
    if (!seasonId) return { picks: [], pool: [] };
    const picks = await ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", seasonId))
      .take(MAX_DRAFT_POOL);
    const players = await playersById(
      ctx,
      picks.flatMap((p) => (p.playerId ? [p.playerId] : [])),
    );
    const created = await ctx.db
      .query("players")
      .withIndex("by_createdSeasonId", (q) => q.eq("createdSeasonId", seasonId))
      .take(MAX_DRAFT_POOL);
    return {
      picks: picks.flatMap((pick) => {
        const player = pick.playerId ? players.get(pick.playerId) : undefined;
        return player ? [{ overall: pick.overall, player: poolPlayer(player) }] : [];
      }),
      pool: created.map(poolPlayer),
    };
  },
});

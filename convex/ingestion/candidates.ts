/** Who the printed names in a box score might be: the extraction action's roster lookup. */
import { v } from "convex/values";
import { nameTokens, type NameCandidate } from "../../shared/ingestion/nameMatch";
import type { Id } from "../_generated/dataModel";
import { internalQuery } from "../_generated/server";
import { activeFranchise, teamsById } from "../lib/franchise";

const MAX_ROSTER = 150;
const SEARCH_HITS = 5;
const MAX_NAMES = 120;

/**
 * Players a printed name may refer to: both teams' rosters for the season, then a text search
 * across the franchise for each name (traded players, typos in the roster).
 */
export const forNames = internalQuery({
  args: {
    seasonId: v.union(v.id("seasons"), v.null()),
    teamAbbrs: v.array(v.string()),
    names: v.array(v.string()),
  },
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      displayName: v.string(),
      firstName: v.string(),
      lastName: v.string(),
      aliases: v.array(v.string()),
      teamAbbr: v.union(v.string(), v.null()),
      position: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx, { seasonId, teamAbbrs, names }) => {
    const out = new Map<Id<"players">, NameCandidate<Id<"players">>>();
    const teams = [...(await teamsById(ctx)).values()].filter((t) => teamAbbrs.includes(t.abbr));
    const franchise = await activeFranchise(ctx);
    if (seasonId) {
      for (const team of teams) {
        const entries = await ctx.db
          .query("rosterEntries")
          .withIndex("by_seasonId_and_teamId", (q) => q.eq("seasonId", seasonId).eq("teamId", team._id))
          .take(MAX_ROSTER);
        for (const entry of entries) {
          const player = await ctx.db.get("players", entry.playerId);
          if (!player) continue;
          out.set(player._id, {
            playerId: player._id,
            displayName: player.displayName,
            firstName: player.firstName,
            lastName: player.lastName,
            aliases: player.aliases,
            teamAbbr: team.abbr,
            position: entry.position,
          });
        }
      }
    }
    for (const name of names.slice(0, MAX_NAMES)) {
      const last = nameTokens(name).at(-1);
      if (!last) continue;
      const hits = await ctx.db
        .query("players")
        .withSearchIndex("search_displayName", (q) =>
          q.search("displayName", last).eq("franchiseId", franchise._id),
        )
        .take(SEARCH_HITS);
      for (const p of hits) {
        if (out.has(p._id)) continue;
        out.set(p._id, {
          playerId: p._id,
          displayName: p.displayName,
          firstName: p.firstName,
          lastName: p.lastName,
          aliases: p.aliases,
          teamAbbr: null,
          position: p.position,
        });
      }
    }
    return [...out.values()].map((c) => ({
      ...c,
      aliases: [...c.aliases],
      teamAbbr: c.teamAbbr ?? null,
      position: c.position ?? null,
    }));
  },
});

/** Exact saved choices are scoped by franchise, season, and team, including players outside search hits. */
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
    }),
  ),
  handler: async (ctx, { seasonId, names }) => {
    if (!seasonId) return [];
    const franchise = await activeFranchise(ctx);
    const out = [];
    for (const row of names.slice(0, MAX_NAMES)) {
      if (!row.teamAbbr) continue;
      const normalizedName = nameTokens(row.name).join(" ");
      const saved = await ctx.db
        .query("playerNameAssignments")
        .withIndex("by_franchiseId_and_seasonId_and_teamAbbr_and_normalizedName", (q) =>
          q
            .eq("franchiseId", franchise._id)
            .eq("seasonId", seasonId)
            .eq("teamAbbr", row.teamAbbr!)
            .eq("normalizedName", normalizedName),
        )
        .unique();
      if (!saved) continue;
      const player = await ctx.db.get("players", saved.playerId);
      if (player?.franchiseId === franchise._id)
        out.push({ normalizedName, teamAbbr: row.teamAbbr, playerId: player._id, name: player.displayName });
    }
    return out;
  },
});

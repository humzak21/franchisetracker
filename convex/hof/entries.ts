/**
 * Hall of Fame (FEATURES.md 4.6, 5.7): the jersey wall, induction from any player page, coaches
 * and staff, retired numbers. Each player plaque caches the career with the team, refreshed on save.
 */
import { v } from "convex/values";
import { currentSeasonYear } from "../../shared/seasons/reports";
import type { StatLine } from "../../shared/stats";
import type { Id } from "../_generated/dataModel";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { careerWithTeam } from "../lib/hof";
import { headshotUrls, toTeamRef, vTeamRef } from "../lib/refs";
import { franchiseSeasonList } from "../lib/reports";
import { vPosition } from "../lib/validators";
import schema from "../schema";

const MAX_ENTRIES = 300;
/** Every stat's career list at 25 entries, with headroom. */
const MAX_PLACEMENTS = 2_000;
const MAX_CANDIDATES = 12;
const MAX_BLURB = 2_000;
const MAX_NAME = 60;

function checkYear(year: number) {
  if (!Number.isInteger(year) || year < 1900 || year > 2100)
    throw invalid("Induction year must be between 1900 and 2100");
}

function checkJersey(jersey: number | undefined) {
  if (jersey !== undefined && (!Number.isInteger(jersey) || jersey < 0 || jersey > 99)) {
    throw invalid("Jersey numbers run from 0 to 99");
  }
}

function cleanBlurb(blurb: string | undefined) {
  const trimmed = blurb?.trim();
  if (trimmed && trimmed.length > MAX_BLURB) throw invalid(`Keep the blurb under ${MAX_BLURB} characters`);
  return trimmed ? trimmed : undefined;
}

/** A stat line as stored: recorded stats only. */
function statMap(line: StatLine): Record<string, number> {
  return Object.fromEntries(Object.entries(line).filter((e): e is [string, number] => e[1] !== undefined));
}

/**
 * Retired players the team's career book still lists and the wall does not: the people worth
 * opening a plaque for, most placements first.
 */
export const candidates = query({
  args: {},
  returns: v.array(
    v.object({
      playerId: v.id("players"),
      displayName: v.string(),
      position: vPosition,
      placements: v.number(),
      bestRank: v.number(),
      headshotUrl: v.union(v.string(), v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [placements, entries] = await Promise.all([
      ctx.db
        .query("recordPlacements")
        .withIndex("by_franchiseId_and_book_and_split_and_scope_and_statKey", (q) =>
          q.eq("franchiseId", franchise._id).eq("book", "team").eq("split", "regular").eq("scope", "career"),
        )
        .take(MAX_PLACEMENTS),
      ctx.db
        .query("hofEntries")
        .withIndex("by_franchiseId_and_inductedYear", (q) => q.eq("franchiseId", franchise._id))
        .take(MAX_ENTRIES),
    ]);
    const inducted = new Set(entries.map((e) => e.playerId));
    const counted = new Map<Id<"players">, { placements: number; bestRank: number }>();
    for (const { playerId, rank } of placements) {
      if (inducted.has(playerId)) continue;
      const seen = counted.get(playerId);
      counted.set(playerId, {
        placements: (seen?.placements ?? 0) + 1,
        bestRank: Math.min(seen?.bestRank ?? rank, rank),
      });
    }
    const players = await playersById(ctx, counted.keys());
    const retired = [...players.values()].filter((p) => p.retired);
    const photos = await headshotUrls(ctx, retired);
    return retired
      .map((p) => ({
        playerId: p._id,
        displayName: p.displayName,
        position: p.position,
        ...must(counted.get(p._id), "Placements"),
        headshotUrl: photos.get(p._id) ?? null,
      }))
      .sort((a, b) => b.placements - a.placements || a.bestRank - b.bestRank)
      .slice(0, MAX_CANDIDATES);
  },
});

/** Every inductee with what the wall draws: name, position or title, and the team's colors. */
export const wall = query({
  args: {},
  returns: v.array(
    v.object({
      entry: schema.doc("hofEntries"),
      name: v.string(),
      team: v.union(vTeamRef, v.null()),
    }),
  ),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const entries = await ctx.db
      .query("hofEntries")
      .withIndex("by_franchiseId_and_inductedYear", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_ENTRIES);
    const [players, teams] = await Promise.all([
      playersById(
        ctx,
        entries.flatMap((e) => (e.playerId ? [e.playerId] : [])),
      ),
      teamsById(ctx),
    ]);
    return entries.map((entry) => {
      const team = teams.get(entry.teamId ?? franchise.userTeamId);
      const name = entry.playerId ? players.get(entry.playerId)?.displayName : entry.staffName;
      return { entry, name: name ?? "Unknown", team: team ? toTeamRef(team) : null };
    });
  },
});

/** A player's plaque, or what the induction form starts from: number, seasons with the team, this year. */
export const forPlayer = query({
  args: { playerId: v.id("players") },
  returns: v.object({
    entry: v.union(schema.doc("hofEntries"), v.null()),
    defaults: v.object({
      inductedYear: v.number(),
      jersey: v.optional(v.number()),
      years: v.array(v.number()),
    }),
  }),
  handler: async (ctx, { playerId }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const [entry, career, seasons] = await Promise.all([
      ctx.db
        .query("hofEntries")
        .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
        .first(),
      careerWithTeam(ctx, playerId, franchise.userTeamId),
      franchiseSeasonList(ctx, franchise._id),
    ]);
    return {
      entry,
      defaults: {
        inductedYear: currentSeasonYear(seasons, franchise.startYear),
        jersey: career.jersey,
        years: career.years,
      },
    };
  },
});

const vInduction = {
  inductedYear: v.number(),
  jersey: v.optional(v.number()),
  retiredNumber: v.boolean(),
  blurb: v.optional(v.string()),
};

/** Inducts a player, or updates their plaque. One entry per player; the career cache is refreshed. */
export const inductPlayer = mutation({
  args: { playerId: v.id("players"), highlightSeasons: v.optional(v.array(v.number())), ...vInduction },
  returns: v.id("hofEntries"),
  handler: async (ctx, { playerId, inductedYear, jersey, retiredNumber, blurb, highlightSeasons }) => {
    await requireOwner(ctx);
    checkYear(inductedYear);
    checkJersey(jersey);
    const franchise = await activeFranchise(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const career = await careerWithTeam(ctx, playerId, franchise.userTeamId);
    const fields = {
      franchiseId: franchise._id,
      playerId,
      role: player.position,
      teamId: franchise.userTeamId,
      jersey,
      inductedYear,
      retiredNumber: retiredNumber && jersey !== undefined,
      blurb: cleanBlurb(blurb),
      firstYear: career.years[0],
      lastYear: career.years.at(-1),
      highlightSeasons: highlightSeasons?.filter((y) => career.years.includes(y)).sort((a, b) => a - b),
      careerSummary: statMap(career.totals),
      careerGames: career.games,
    };
    const existing = await ctx.db
      .query("hofEntries")
      .withIndex("by_playerId", (q) => q.eq("playerId", playerId))
      .first();
    if (existing) {
      await ctx.db.replace("hofEntries", existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("hofEntries", fields);
  },
});

/** Inducts a coach or staff member (no player page), or updates one when `entryId` is given. */
export const saveStaff = mutation({
  args: {
    entryId: v.optional(v.id("hofEntries")),
    staffName: v.string(),
    role: v.string(),
    firstYear: v.optional(v.number()),
    lastYear: v.optional(v.number()),
    ...vInduction,
  },
  returns: v.id("hofEntries"),
  handler: async (
    ctx,
    { entryId, staffName, role, firstYear, lastYear, inductedYear, jersey, retiredNumber, blurb },
  ) => {
    await requireOwner(ctx);
    checkYear(inductedYear);
    checkJersey(jersey);
    const name = staffName.trim();
    const title = role.trim();
    if (!name || name.length > MAX_NAME || !title || title.length > MAX_NAME) {
      throw invalid(`Give a name and a title, each up to ${MAX_NAME} characters`);
    }
    if (firstYear !== undefined && lastYear !== undefined && firstYear > lastYear) {
      throw invalid("The first year comes before the last");
    }
    const franchise = await activeFranchise(ctx);
    const fields = {
      franchiseId: franchise._id,
      staffName: name,
      role: title,
      teamId: franchise.userTeamId,
      jersey,
      inductedYear,
      retiredNumber: retiredNumber && jersey !== undefined,
      blurb: cleanBlurb(blurb),
      firstYear,
      lastYear,
    };
    if (entryId) {
      const existing = must(await ctx.db.get("hofEntries", entryId), "Hall of Fame entry");
      if (existing.playerId) throw invalid("Edit a player's plaque from their page");
      await ctx.db.replace("hofEntries", entryId, fields);
      return entryId;
    }
    return await ctx.db.insert("hofEntries", fields);
  },
});

export const remove = mutation({
  args: { entryId: v.id("hofEntries") },
  returns: v.null(),
  handler: async (ctx, { entryId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("hofEntries", entryId), "Hall of Fame entry");
    await ctx.db.delete("hofEntries", entryId);
    return null;
  },
});

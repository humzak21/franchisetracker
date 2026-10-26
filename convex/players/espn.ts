/**
 * Matching players to ESPN (FEATURES.md 5.4): search by name, suggest a match for a whole
 * roster, and confirm one, which stores the ESPN id, fills missing bio fields and caches the
 * headshot. Imported players arrive with their ESPN id; this is for everyone else.
 */
import { v } from "convex/values";
import { nameTokens } from "../../shared/ingestion/nameMatch";
import { internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { action, internalMutation, internalQuery } from "../_generated/server";
import { requireOwner, requireSignedIn } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { seasonYears } from "../lib/refs";
import { espnHeadshotUrl, fetchAthlete, searchAthletes, type EspnAthlete } from "../external/espn";
import { cacheHeadshots } from "../external/media";

const DETAILED = 5;
const MAX_SUGGEST = 60;
const MAX_ENTRIES = 60;

const vCandidate = v.object({
  espnId: v.number(),
  name: v.string(),
  position: v.union(v.string(), v.null()),
  teamAbbr: v.union(v.string(), v.null()),
  college: v.union(v.string(), v.null()),
  age: v.union(v.number(), v.null()),
  headshotUrl: v.union(v.string(), v.null()),
});

type Subject = { playerId: Id<"players">; name: string; teamAbbr: string | null };

const toCandidate = (a: EspnAthlete) => ({
  espnId: a.espnId,
  name: a.name,
  position: a.position ?? null,
  teamAbbr: a.teamAbbr ?? null,
  college: a.college ?? null,
  age: a.age ?? null,
  headshotUrl: a.hasHeadshot ? espnHeadshotUrl(a.espnId) : null,
});

/** Names and latest teams of the players to match; checks the caller is the owner. */
export const subjects = internalQuery({
  args: { playerIds: v.array(v.id("players")) },
  returns: v.array(
    v.object({ playerId: v.id("players"), name: v.string(), teamAbbr: v.union(v.string(), v.null()) }),
  ),
  handler: async (ctx, { playerIds }) => {
    await requireOwner(ctx);
    const out = [];
    for (const playerId of playerIds.slice(0, MAX_SUGGEST)) {
      const player = await ctx.db.get("players", playerId);
      if (!player) continue;
      const entries = await ctx.db
        .query("rosterEntries")
        .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId))
        .take(MAX_ENTRIES);
      const years = await seasonYears(
        ctx,
        entries.map((e) => e.seasonId),
      );
      const entry = [...entries].sort(
        (a, b) => (years.get(b.seasonId) ?? 0) - (years.get(a.seasonId) ?? 0),
      )[0];
      const team = entry ? await ctx.db.get("teams", entry.teamId) : null;
      out.push({ playerId, name: player.displayName, teamAbbr: team?.abbr ?? null });
    }
    return out;
  },
});

/** ESPN players matching a name (the player's own by default), with enough bio to tell them apart. */
export const search = action({
  args: { playerId: v.id("players"), query: v.optional(v.string()) },
  returns: v.array(vCandidate),
  handler: async (ctx, { playerId, query }) => {
    await requireSignedIn(ctx);
    const [subject]: Subject[] = await ctx.runQuery(internal.players.espn.subjects, {
      playerIds: [playerId],
    });
    const name = query?.trim() || subject?.name;
    if (!name) return [];
    const hits = await searchAthletes(name, DETAILED);
    const athletes = await Promise.all(hits.map((h) => fetchAthlete(h.espnId)));
    return athletes.filter((a): a is EspnAthlete => a !== null).map(toCandidate);
  },
});

/** One suggested match per player: an exact name hit, preferring one on the same team. */
export const suggest = action({
  args: { playerIds: v.array(v.id("players")) },
  returns: v.array(v.object({ playerId: v.id("players"), candidate: v.union(vCandidate, v.null()) })),
  handler: async (ctx, { playerIds }) => {
    await requireSignedIn(ctx);
    const subjects: Subject[] = await ctx.runQuery(internal.players.espn.subjects, { playerIds });
    return await Promise.all(
      subjects.map(async ({ playerId, name, teamAbbr }) => {
        const key = nameTokens(name).join(" ");
        const exact = (await searchAthletes(name, DETAILED)).filter(
          (h) => nameTokens(h.name).join(" ") === key,
        );
        const athletes = (await Promise.all(exact.map((h) => fetchAthlete(h.espnId)))).filter(
          (a): a is EspnAthlete => a !== null,
        );
        const best = athletes.find((a) => teamAbbr && a.teamAbbr === teamAbbr) ?? athletes[0];
        return { playerId, candidate: best ? toCandidate(best) : null };
      }),
    );
  },
});

export const applyMatch = internalMutation({
  args: {
    playerId: v.id("players"),
    espnId: v.number(),
    college: v.optional(v.string()),
    heightIn: v.optional(v.number()),
    weightLb: v.optional(v.number()),
  },
  returns: v.null(),
  handler: async (ctx, { playerId, espnId, college, heightIn, weightLb }) => {
    await requireOwner(ctx);
    const player = must(await ctx.db.get("players", playerId), "Player");
    const changed = player.espnId !== espnId;
    if (changed && player.headshotStorageId) await ctx.storage.delete(player.headshotStorageId);
    await ctx.db.patch("players", playerId, {
      espnId,
      isReal: true,
      ...(changed ? { headshotStorageId: undefined } : {}),
      // Fill gaps only; what the owner or the import already knows stays.
      college: player.college ?? college,
      heightIn: player.heightIn ?? heightIn,
      weightLb: player.weightLb ?? weightLb,
    });
    return null;
  },
});

/** Confirms that a player is this ESPN athlete and caches the headshot. */
export const confirm = action({
  args: { playerId: v.id("players"), espnId: v.number() },
  returns: v.null(),
  handler: async (ctx, { playerId, espnId }) => {
    await requireSignedIn(ctx);
    const athlete = await fetchAthlete(espnId);
    if (!athlete) throw invalid("ESPN has no player with that id");
    await ctx.runMutation(internal.players.espn.applyMatch, {
      playerId,
      espnId,
      college: athlete.college,
      heightIn: athlete.heightIn,
      weightLb: athlete.weightLb,
    });
    if (athlete.hasHeadshot) await cacheHeadshots(ctx, [{ playerId, espnId }]);
    return null;
  },
});

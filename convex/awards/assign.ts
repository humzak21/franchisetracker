/**
 * Assigning a season award by hand (FEATURES.md 5.8): one winner for a yearly award (per
 * conference for the conference awards), replacing whatever the awards screen import or the stats
 * counted. Clearing puts the count back. Coach of the Year goes to a coach, not a player.
 */
import { v } from "convex/values";
import { isConferenceAward } from "../../shared/awards/groups";
import { AWARD_INFO, type AwardType } from "../../shared/domain/awards";
import type { Conference } from "../../shared/domain/teams";
import type { Id } from "../_generated/dataModel";
import { mutation, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { ensureCoach } from "../lib/coaches";
import { invalid, must } from "../lib/errors";
import { ownSeason } from "../lib/reports";
import { vAwardType, vConference } from "../lib/validators";

/** A season's winners of one award, ties and stray duplicates included. */
const MAX_WINNERS = 20;
const MAX_STAT_LINE = 80;

/** The conference the slot is for: required by the conference awards, refused by the rest. */
function slotConference(type: AwardType, conference: Conference | undefined) {
  const { cadence, label } = AWARD_INFO[type];
  if (cadence !== "yearly" && cadence !== "counted")
    throw invalid(`${label} is not a one-winner season award`);
  if (isConferenceAward(type) && !conference) throw invalid(`Pick the AFC or NFC ${label}`);
  return isConferenceAward(type) ? conference : undefined;
}

/**
 * Removes the season's stored winners of a yearly award, in one conference for the conference
 * awards (a winner stored without one counts in their team's); weekly and team awards are never touched.
 */
async function clearWinners(
  ctx: MutationCtx,
  seasonId: Id<"seasons">,
  type: AwardType,
  conference: Conference | undefined,
) {
  const stored = await ctx.db
    .query("awards")
    .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", seasonId).eq("type", type))
    .take(MAX_WINNERS);
  for (const award of stored) {
    if (award.weekKey || award.scope === "team") continue;
    const team = award.teamId ? await ctx.db.get("teams", award.teamId) : null;
    if (conference && (award.conference ?? team?.conference) !== conference) continue;
    await ctx.db.delete("awards", award._id);
  }
}

/** The team a player finished the season with: roster entries are written in season order. */
async function seasonTeam(ctx: MutationCtx, playerId: Id<"players">, seasonId: Id<"seasons">) {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", playerId).eq("seasonId", seasonId))
    .take(10);
  return entries.at(-1)?.teamId;
}

export const assign = mutation({
  args: {
    seasonId: v.id("seasons"),
    type: vAwardType,
    conference: v.optional(vConference),
    playerId: v.id("players"),
    statLine: v.optional(v.string()),
  },
  returns: v.id("awards"),
  handler: async (ctx, { seasonId, type, playerId, statLine, ...args }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    const conference = slotConference(type, args.conference);
    if (AWARD_INFO[type].coach) throw invalid(`${AWARD_INFO[type].label} goes to a coach`);
    const player = must(await ctx.db.get("players", playerId), "Player");
    if (player.franchiseId !== franchise._id) throw invalid("That player belongs to another franchise");
    const line = statLine?.trim();
    if (line && line.length > MAX_STAT_LINE)
      throw invalid(`Keep the stat line under ${MAX_STAT_LINE} characters`);
    const teamId = await seasonTeam(ctx, playerId, seasonId);
    await clearWinners(ctx, seasonId, type, conference);
    return await ctx.db.insert("awards", {
      franchiseId: franchise._id,
      seasonId,
      scope: conference ? "conference" : "league",
      type,
      conference,
      playerId,
      teamId,
      statLine: line || undefined,
    });
  },
});

/** Coach of the Year: a coach from the bank or created here; a name neither knows is created. */
export const assignCoach = mutation({
  args: { seasonId: v.id("seasons"), name: v.string(), teamId: v.optional(v.id("teams")) },
  returns: v.id("awards"),
  handler: async (ctx, { seasonId, name, teamId }) => {
    await requireOwner(ctx);
    const { franchise } = await ownSeason(ctx, seasonId);
    if (teamId) must(await ctx.db.get("teams", teamId), "Team");
    const coach = await ensureCoach(ctx, franchise._id, name, teamId);
    await clearWinners(ctx, seasonId, "COY", undefined);
    return await ctx.db.insert("awards", {
      franchiseId: franchise._id,
      seasonId,
      scope: "league",
      type: "COY",
      rawName: coach,
      teamId,
    });
  },
});

export const clear = mutation({
  args: { seasonId: v.id("seasons"), type: vAwardType, conference: v.optional(vConference) },
  returns: v.null(),
  handler: async (ctx, { seasonId, type, ...args }) => {
    await requireOwner(ctx);
    await ownSeason(ctx, seasonId);
    await clearWinners(ctx, seasonId, type, slotConference(type, args.conference));
    return null;
  },
});

/** The injury report by hand (FEATURES.md 5.10): log, correct or remove an injury. */
import { v } from "convex/values";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vWeekKey } from "../lib/validators";
import { resolvePeople, vPersonInput } from "./people";

const MAX_TEXT = 80;
const MAX_NOTE = 2000;

export const save = mutation({
  args: {
    /** Set to edit an existing injury. */
    injuryId: v.optional(v.id("injuries")),
    seasonId: v.id("seasons"),
    player: vPersonInput,
    teamId: v.optional(v.id("teams")),
    weekKey: v.optional(vWeekKey),
    injuryType: v.string(),
    lengthWeeks: v.optional(v.number()),
    lengthLabel: v.optional(v.string()),
    onIr: v.boolean(),
    returnWeekKey: v.optional(vWeekKey),
    notes: v.optional(v.string()),
  },
  returns: v.id("injuries"),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const season = must(await ctx.db.get("seasons", args.seasonId), "Season");
    if (season.franchiseId !== franchise._id) throw invalid("That season is in another franchise");
    const injuryType = args.injuryType.trim();
    if (!injuryType || injuryType.length > MAX_TEXT) throw invalid("Name the injury");
    const weeks = args.lengthWeeks;
    if (weeks !== undefined && (!Number.isInteger(weeks) || weeks < 0 || weeks > 52))
      throw invalid("Weeks out runs from 0 to 52");
    if ((args.lengthLabel?.length ?? 0) > MAX_TEXT) throw invalid("Keep the length short");
    if ((args.notes?.length ?? 0) > MAX_NOTE) throw invalid(`Keep notes under ${MAX_NOTE} characters`);
    if (args.teamId) must(await ctx.db.get("teams", args.teamId), "Team");
    const existing = args.injuryId ? must(await ctx.db.get("injuries", args.injuryId), "Injury") : null;
    const [person] = await resolvePeople(ctx, franchise._id, season.year, [args.player]);
    const fields = {
      seasonId: season._id,
      weekKey: args.weekKey,
      playerId: must(person, "Player").player._id,
      teamId: args.teamId ?? franchise.userTeamId,
      injuryType,
      lengthWeeks: weeks,
      lengthLabel: args.lengthLabel?.trim() || undefined,
      onIr: args.onIr,
      returnWeekKey: args.returnWeekKey,
      notes: args.notes?.trim() || undefined,
    };
    if (existing) {
      await ctx.db.patch("injuries", existing._id, fields);
      return existing._id;
    }
    return await ctx.db.insert("injuries", { franchiseId: franchise._id, ...fields });
  },
});

export const remove = mutation({
  args: { injuryId: v.id("injuries") },
  returns: v.null(),
  handler: async (ctx, { injuryId }) => {
    await requireOwner(ctx);
    must(await ctx.db.get("injuries", injuryId), "Injury");
    await ctx.db.delete("injuries", injuryId);
    return null;
  },
});

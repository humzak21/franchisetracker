/**
 * Creating a player by hand (FEATURES.md 5.4): a created player, a draft-class rookie or anyone
 * screenshots have not brought in yet, optionally straight onto a team's roster for a season.
 */
import { v } from "convex/values";
import { applyPlayerPatch } from "../../shared/players/playerPatch";
import { applyEntryPatch } from "../../shared/roster/entryPatch";
import { mutation } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { vPosition } from "../lib/validators";
import { vEntryPatch, vPlayerPatch } from "./patches";

export const create = mutation({
  args: {
    displayName: v.string(),
    position: vPosition,
    isReal: v.boolean(),
    bio: v.optional(vPlayerPatch),
    entry: v.optional(v.object({ seasonId: v.id("seasons"), teamId: v.id("teams"), patch: vEntryPatch })),
  },
  returns: v.id("players"),
  handler: async (ctx, { displayName, position, isReal, bio, entry }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const blank = { firstName: "", lastName: "", displayName: "", aliases: [], position, retired: false };
    const player = applyPlayerPatch(blank, { ...bio, displayName, position });
    if (!player.ok) throw invalid(player.error);
    if (bio?.draft?.teamId) must(await ctx.db.get("teams", bio.draft.teamId), "Draft team");

    const season = entry ? must(await ctx.db.get("seasons", entry.seasonId), "Season") : null;
    if (season && season.franchiseId !== franchise._id) throw invalid("That season is in another franchise");
    if (entry) must(await ctx.db.get("teams", entry.teamId), "Team");
    const fields = entry ? applyEntryPatch({ position, status: "active" }, entry.patch) : null;
    if (fields && !fields.ok) throw invalid(fields.error);
    const age = fields?.ok ? fields.fields.age : undefined;

    const playerId = await ctx.db.insert("players", {
      ...player.fields,
      franchiseId: franchise._id,
      firstName: player.fields.firstName ?? "",
      lastName: player.fields.lastName ?? displayName,
      displayName: player.fields.displayName ?? displayName,
      position,
      isReal,
      origin: "manual",
      createdSeasonId: season?._id,
      retired: player.fields.retired ?? false,
      aliases: [],
      // An age on the roster entry is the only age known: anchor it so later seasons count up.
      ...(player.fields.birthYear === undefined && age !== undefined && season
        ? { ageAnchor: { age, year: season.year } }
        : {}),
    });
    if (entry && fields?.ok) {
      await ctx.db.insert("rosterEntries", {
        ...fields.fields,
        position: fields.fields.position ?? position,
        status: fields.fields.status ?? "active",
        franchiseId: franchise._id,
        seasonId: entry.seasonId,
        teamId: entry.teamId,
        playerId,
      });
    }
    return playerId;
  },
});

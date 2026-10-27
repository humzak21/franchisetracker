/** Players and roster entries for committed screens: box score lines and every row target. */
import { inferPosition } from "../../shared/ingestion/normalize";
import type { StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";

import { rememberPlayer } from "./playerAssignments";

const MAX_ALIASES = 20;

function splitName(printed: string): { firstName: string; lastName: string } {
  const parts = printed.trim().split(/\s+/);
  const lastName = parts.pop() ?? printed;
  return { firstName: parts.join(" "), lastName };
}

type Printed = {
  name: string;
  playerId: Id<"players"> | null;
  position: Doc<"players">["position"] | null;
  /** For a new player whose screen printed no position. */
  stats?: StatLine;
  seasonId?: Id<"seasons">;
  teamAbbr?: string;
};

/** The player a row commits to: the one review chose, or a new player named as printed. */
export async function playerFor(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  printed: Printed,
): Promise<Doc<"players">> {
  const remember = async (player: Doc<"players">) => {
    if (printed.seasonId && printed.teamAbbr)
      await rememberPlayer(ctx, {
        franchiseId,
        seasonId: printed.seasonId,
        teamAbbr: printed.teamAbbr,
        name: printed.name,
        playerId: player._id,
      });
    return player;
  };
  if (printed.playerId) {
    const player = must(await ctx.db.get("players", printed.playerId), `Player for ${printed.name}`);
    if (player.franchiseId !== franchiseId) throw invalid("Player must belong to this franchise");
    // Remember how this screen prints the name so the next extraction resolves it outright.
    const known = [player.displayName, ...player.aliases].map((n) => n.toLowerCase());
    if (!known.includes(printed.name.toLowerCase()) && player.aliases.length < MAX_ALIASES) {
      await ctx.db.patch("players", player._id, { aliases: [...player.aliases, printed.name] });
    }
    return await remember(player);
  }
  const id = await ctx.db.insert("players", {
    franchiseId,
    ...splitName(printed.name),
    displayName: printed.name,
    position: printed.position ?? inferPosition(printed.stats ?? {}),
    // Franchises start from real NFL rosters; a player who turns out fictional is marked from their page.
    isReal: true,
    retired: false,
    aliases: [],
  });
  return await remember(must(await ctx.db.get("players", id), "New player"));
}

type RosterFields = Partial<
  Pick<
    Doc<"rosterEntries">,
    | "jersey"
    | "ovr"
    | "age"
    | "exp"
    | "devTrait"
    | "abilities"
    | "contract"
    | "acquisition"
    | "status"
    | "statusWeekKey"
  >
>;

/**
 * The player's roster entry for a team and season, created when missing. Other teams' entries
 * from box scores, leaders and awards are partial; a roster page or player card fills them in.
 */
export async function ensureRosterEntry(
  ctx: MutationCtx,
  args: {
    player: Doc<"players">;
    seasonId: Id<"seasons">;
    teamId: Id<"teams">;
    userTeamId: Id<"teams">;
    position: Doc<"players">["position"];
    fields?: RosterFields;
    /** The screen showed the whole entry (a roster page, a player card). */
    complete?: boolean;
  },
): Promise<Id<"rosterEntries">> {
  const { player, seasonId, teamId, fields = {} } = args;
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", seasonId))
    .take(10);
  const existing = entries.find((e) => e.teamId === teamId);
  const defined = Object.fromEntries(
    Object.entries(fields).filter(([, v]) => v !== undefined),
  ) as RosterFields;
  if (existing) {
    if (Object.keys(defined).length > 0 || args.complete) {
      await ctx.db.patch("rosterEntries", existing._id, {
        ...defined,
        ...(args.complete ? { position: args.position, partial: undefined } : {}),
      });
    }
    return existing._id;
  }
  return await ctx.db.insert("rosterEntries", {
    franchiseId: player.franchiseId,
    seasonId,
    teamId,
    playerId: player._id,
    position: args.position,
    status: "active",
    ...defined,
    ...(teamId === args.userTeamId || args.complete ? {} : { partial: true }),
  });
}

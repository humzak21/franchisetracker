/**
 * Writes a reviewed box score: player entities and roster entries where missing, the game's
 * stat lines (replacing any from an earlier commit), then the affected aggregates.
 */
import { inferPosition } from "../../shared/ingestion/normalize";
import type { StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import type { StoredDraft } from "../lib/draftValidators";
import { must } from "../lib/errors";
import { recomputeCareer, recomputePlayerSeason } from "../stats/recompute";
import { teamByAbbr } from "./commitGame";

type BoxScore = Extract<StoredDraft, { target: "game_box_score" }>;
type Line = BoxScore["lines"][number];

/** Two full rosters' worth of lines with room to spare. */
const MAX_LINES_PER_GAME = 200;
const MAX_ALIASES = 20;

function splitName(printed: string): { firstName: string; lastName: string } {
  const parts = printed.trim().split(/\s+/);
  const lastName = parts.pop() ?? printed;
  return { firstName: parts.join(" "), lastName };
}

/** The player a line commits to: the one review chose, or a new player named as printed. */
async function playerFor(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  line: Line,
): Promise<Doc<"players">> {
  if (line.playerId) {
    const player = must(await ctx.db.get("players", line.playerId), `Player for ${line.name}`);
    // Remember how this screen prints the name so the next extraction resolves it outright.
    const known = [player.displayName, ...player.aliases].map((n) => n.toLowerCase());
    if (!known.includes(line.name.toLowerCase()) && player.aliases.length < MAX_ALIASES) {
      await ctx.db.patch("players", player._id, { aliases: [...player.aliases, line.name] });
    }
    return player;
  }
  const id = await ctx.db.insert("players", {
    franchiseId,
    ...splitName(line.name),
    displayName: line.name,
    position: line.position ?? inferPosition(line.stats as StatLine),
    // Franchises start from real NFL rosters; fictional draft classes arrive through the draft import.
    isReal: true,
    retired: false,
    aliases: [],
  });
  return must(await ctx.db.get("players", id), "New player");
}

async function ensureRosterEntry(
  ctx: MutationCtx,
  player: Doc<"players">,
  game: Doc<"games">,
  teamId: Id<"teams">,
  userTeamId: Id<"teams">,
  position: Doc<"players">["position"],
) {
  const entries = await ctx.db
    .query("rosterEntries")
    .withIndex("by_playerId_and_seasonId", (q) => q.eq("playerId", player._id).eq("seasonId", game.seasonId))
    .take(10);
  if (entries.some((e) => e.teamId === teamId)) return;
  await ctx.db.insert("rosterEntries", {
    franchiseId: player.franchiseId,
    seasonId: game.seasonId,
    teamId,
    playerId: player._id,
    position,
    status: "active",
    // Other teams' rosters are only what box scores reveal.
    ...(teamId === userTeamId ? {} : { partial: true }),
  });
}

export async function commitBoxScore(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  game: Doc<"games">,
  draft: BoxScore,
): Promise<Id<"players">[]> {
  const previous = [];
  for (const teamId of [game.homeTeamId, game.awayTeamId]) {
    if (!teamId) continue;
    previous.push(
      ...(await ctx.db
        .query("gameStatLines")
        .withIndex("by_gameId_and_teamId", (q) => q.eq("gameId", game._id).eq("teamId", teamId))
        .take(MAX_LINES_PER_GAME)),
    );
  }
  for (const line of previous) await ctx.db.delete("gameStatLines", line._id);

  const affected = new Map<Id<"players">, Doc<"players">>();
  for (const line of draft.lines) {
    if (Object.keys(line.stats).length === 0) continue;
    const team = await teamByAbbr(ctx, line.teamAbbr);
    const player = await playerFor(ctx, franchise._id, line);
    const position = line.position ?? player.position;
    await ensureRosterEntry(ctx, player, game, team._id, franchise.userTeamId, position);
    await ctx.db.insert("gameStatLines", {
      franchiseId: franchise._id,
      seasonId: game.seasonId,
      gameId: game._id,
      playerId: player._id,
      teamId: team._id,
      weekKey: game.weekKey,
      position,
      stats: line.stats,
    });
    affected.set(player._id, player);
  }
  // Players dropped from this box score since the last commit lose those games too.
  for (const line of previous) {
    if (affected.has(line.playerId)) continue;
    const player = await ctx.db.get("players", line.playerId);
    if (player) affected.set(player._id, player);
  }
  for (const player of affected.values()) {
    await recomputePlayerSeason(ctx, player, game.seasonId);
    await recomputeCareer(ctx, player);
  }
  return [...affected.keys()];
}

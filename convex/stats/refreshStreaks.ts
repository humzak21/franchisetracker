/** Rewrites team and player streak rows from the franchise's games and the players' game logs. */
import { resultOf } from "../../shared/games/summary";
import { playerStreaks, teamStreaks, type StatLine } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";
import { teamsById } from "../lib/franchise";
import { franchiseGames, playerLines } from "./load";

type Measured = { key: string; current: number; longest: number };

async function writeStreaks(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  playerId: Id<"players"> | undefined,
  measured: readonly Measured[],
): Promise<Map<string, Doc<"streaks">>> {
  const existing = await ctx.db
    .query("streaks")
    .withIndex("by_franchiseId_and_playerId", (q) =>
      q.eq("franchiseId", franchiseId).eq("playerId", playerId),
    )
    .take(20);
  const before = new Map(existing.map((s) => [s.key, s]));
  for (const row of existing)
    if (!measured.some((m) => m.key === row.key)) await ctx.db.delete("streaks", row._id);
  for (const m of measured) {
    const row = before.get(m.key);
    if (!row) await ctx.db.insert("streaks", { franchiseId, playerId, ...m });
    else if (row.current !== m.current || row.longest !== m.longest) {
      await ctx.db.patch("streaks", row._id, { current: m.current, longest: m.longest });
    }
  }
  return before;
}

/** Team streaks; returns the win streak before and after so a new length can be celebrated. */
export async function refreshTeamStreaks(ctx: MutationCtx, franchise: Doc<"franchises">) {
  const teams = await teamsById(ctx);
  const user = teams.get(franchise.userTeamId);
  const games = (await franchiseGames(ctx, franchise._id)).map((g) => {
    const opponent = g.opponentTeamId ? teams.get(g.opponentTeamId) : undefined;
    return {
      result: resultOf(g),
      home: g.userIsHome ?? false,
      division:
        !!opponent &&
        !!user &&
        opponent.conference === user.conference &&
        opponent.division === user.division,
    };
  });
  const measured = teamStreaks(games);
  const before = await writeStreaks(ctx, franchise._id, undefined, measured);
  return {
    winsBefore: before.get("wins")?.current ?? 0,
    winsAfter: measured.find((m) => m.key === "wins")?.current ?? 0,
  };
}

/** A player's streaks over their games with the user team; also returns those lines for milestone detection. */
export async function refreshPlayerStreaks(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  player: Doc<"players">,
) {
  const lines = await playerLines(ctx, player._id);
  const withTeam = lines.filter((l) => l.teamId === franchise.userTeamId);
  await writeStreaks(ctx, franchise._id, player._id, playerStreaks(withTeam.map((l) => l.stats as StatLine)));
  return lines;
}

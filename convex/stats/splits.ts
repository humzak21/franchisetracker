/**
 * Splits (`shared/stats/splits.ts`), one player's or the team's: worked out on read, since a career
 * and the team's games are both bounded. Other teams' lines come from box scores against us, so a
 * player's splits are the games with the user's team.
 */
import { v } from "convex/values";
import { quarterScoring, splitGameOf, splitLines, splitSections, splitTeamGames } from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid, must } from "../lib/errors";
import { activeFranchise, teamsById } from "../lib/franchise";
import { literals, vStatMap } from "../lib/validators";
import { franchiseSeasons, playerLines } from "./load";
import { splitGamesOf } from "./splitGames";
import { teamGameFacts } from "./teamRecords";

const vWhich = v.union(v.id("seasons"), v.literal("all"));
const vKind = literals([
  "phase",
  "venue",
  "outcome",
  "opponent",
  "margin",
  "overtime",
  "byOpponent",
] as const);

const section = <T extends Parameters<typeof v.object>[0]>(group: T) =>
  v.object({
    kind: vKind,
    label: v.string(),
    groups: v.array(v.object({ key: v.string(), label: v.string(), ...group })),
  });

export async function playerSplits(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  playerId: Id<"players">,
  seasonId: Id<"seasons"> | "all",
) {
  const lines = (await playerLines(ctx, playerId)).filter((l) => l.teamId === franchise.userTeamId);
  const kept = seasonId === "all" ? lines : lines.filter((l) => l.seasonId === seasonId);
  const games = await splitGamesOf(ctx, kept, franchise.userTeamId, await teamsById(ctx));
  const years = new Map(lines.map((l) => [l.seasonId, l.year]));
  return {
    seasons: [...years].map(([id, year]) => ({ seasonId: id, year })).sort((a, b) => b.year - a.year),
    sections: splitSections((kind) =>
      splitLines(kept, games, kind).map(({ key, label, summary }) => ({
        key,
        label,
        gamesPlayed: summary.gamesPlayed,
        totals: summary.totals,
      })),
    ),
  };
}

export const player = query({
  args: { playerId: v.id("players"), seasonId: vWhich },
  returns: v.object({
    seasons: v.array(v.object({ seasonId: v.id("seasons"), year: v.number() })),
    sections: v.array(section({ gamesPlayed: v.number(), totals: vStatMap })),
  }),
  handler: async (ctx, { playerId, seasonId }) => {
    await requireOwner(ctx);
    return await playerSplits(ctx, await activeFranchise(ctx), playerId, seasonId);
  },
});

async function seasonsAsked(ctx: QueryCtx, franchise: Doc<"franchises">, seasonId: Id<"seasons"> | "all") {
  if (seasonId === "all") {
    const seasons = await franchiseSeasons(ctx, franchise._id);
    return seasons.filter((s) => s.year >= franchise.startYear);
  }
  const season = must(await ctx.db.get("seasons", seasonId), "Season");
  if (season.franchiseId !== franchise._id) throw invalid("That season belongs to another franchise");
  // A real season before the franchise has no games to split.
  return season.year >= franchise.startYear ? [season] : [];
}

export async function teamSplits(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  seasonId: Id<"seasons"> | "all",
) {
  const teams = await teamsById(ctx);
  const seasons = await seasonsAsked(ctx, franchise, seasonId);
  const facts = (await Promise.all(seasons.map((s) => teamGameFacts(ctx, franchise, s)))).flat();
  const own = teams.get(franchise.userTeamId);
  const games = facts.flatMap((f) => {
    const opponent = f.opponentTeamId ? teams.get(f.opponentTeamId) : undefined;
    if (!own || !opponent) return [];
    const split = splitGameOf({ ...f, own, opponent });
    return [
      {
        ...split,
        pointsFor: f.us,
        pointsAgainst: f.them,
        yards: f.own?.totalYds ?? null,
        yardsAllowed: f.opponent?.totalYds ?? null,
      },
    ];
  });
  return {
    quarters: quarterScoring(facts.filter((f) => f.split === "regular")),
    sections: splitSections((kind) => splitTeamGames(games, kind)),
  };
}

export const team = query({
  args: { seasonId: vWhich },
  returns: v.object({
    quarters: v.object({
      games: v.number(),
      periods: v.array(
        v.object({
          period: v.number(),
          pointsFor: v.number(),
          pointsAgainst: v.number(),
          differential: v.number(),
        }),
      ),
      firstHalf: v.number(),
      secondHalf: v.number(),
    }),
    sections: v.array(
      section({
        games: v.number(),
        wins: v.number(),
        losses: v.number(),
        ties: v.number(),
        pointsFor: v.number(),
        pointsAgainst: v.number(),
        yardsPerGame: v.union(v.number(), v.null()),
        allowedPerGame: v.union(v.number(), v.null()),
      }),
    ),
  }),
  handler: async (ctx, { seasonId }) => {
    await requireOwner(ctx);
    return await teamSplits(ctx, await activeFranchise(ctx), seasonId);
  },
});

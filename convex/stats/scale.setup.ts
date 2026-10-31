/**
 * A 20-season franchise for `scale.test.ts`, and a meter for what one function reads and writes.
 * convex-test enforces no function limits, so the test counts against the real ones instead.
 */
import { REGULAR_WEEKS, type WeekKey } from "../../shared/domain";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx } from "../_generated/server";

/** Convex's limits on one transaction. */
export const FUNCTION_LIMITS = { docsRead: 32_000, bytesRead: 16 * 1024 * 1024, docsWritten: 16_000 };

export const SEASONS = 20;
const PLAYOFF_WEEKS: WeekKey[] = ["wc", "div"];
const WEEKS = [...REGULAR_WEEKS.slice(0, 17), ...PLAYOFF_WEEKS];
export const GAMES_PER_SEASON = WEEKS.length;
/** Who plays every game of all twenty seasons, and who comes in for four. */
export const LIFERS = 8;
const ROTATION = 16;

const line = (i: number, game: number): Record<string, number> =>
  i % 3 === 0
    ? { passAtt: 30, passCmp: 20, passYds: 240 + game, passTd: 2, passInt: 1 }
    : i % 3 === 1
      ? { rushAtt: 15, rushYds: 70 + game, rushTd: 1, rec: 3, recYds: 25 }
      : { tackles: 6, sacks: 1, defInt: game % 5 === 0 ? 1 : 0 };

const score = (game: number) => ({ us: 17 + (game % 21), them: 13 + ((game * 7) % 18) });

type Seeded = {
  lifer: Id<"players">;
  lastGame: Id<"games">;
  lastLines: Id<"players">[];
  lastSeason: Doc<"seasons">;
};

/** Twenty complete seasons of box scores on the franchise, a season per call so no write is huge. */
export async function seedSeason(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  year: number,
  index: number,
  lifers: readonly Id<"players">[],
): Promise<Omit<Seeded, "lifer">> {
  const opponent = (await ctx.db.query("teams").take(2)).find((t) => t._id !== franchise.userTeamId)!;
  const seasonId = await ctx.db.insert("seasons", { franchiseId: franchise._id, year, status: "complete" });
  const players = [...lifers];
  for (let i = 0; i < ROTATION; i++) {
    const name = `Rotation${Math.floor(index / 4)}x${i}`;
    const existing = await ctx.db
      .query("players")
      .withIndex("by_franchiseId_and_displayName", (q) =>
        q.eq("franchiseId", franchise._id).eq("displayName", name),
      )
      .first();
    players.push(existing?._id ?? (await insertPlayer(ctx, franchise, name)));
  }
  let lastGame: Id<"games"> | null = null;
  for (const [game, weekKey] of WEEKS.entries()) {
    const { us, them } = score(game + index);
    const gameId = await ctx.db.insert("games", {
      franchiseId: franchise._id,
      seasonId,
      weekKey,
      homeTeamId: franchise.userTeamId,
      awayTeamId: opponent._id,
      opponentTeamId: opponent._id,
      userIsHome: true,
      homeScore: us,
      awayScore: them,
      result: us > them ? "W" : us < them ? "L" : "T",
      status: "played",
    });
    lastGame = gameId;
    for (const [i, playerId] of players.entries()) {
      await ctx.db.insert("gameStatLines", {
        franchiseId: franchise._id,
        seasonId,
        gameId,
        playerId,
        teamId: franchise.userTeamId,
        weekKey,
        stats: line(i, game),
      });
    }
    for (const [teamId, totalYds] of [
      [franchise.userTeamId, 350],
      [opponent._id, 300],
    ] as const) {
      await ctx.db.insert("gameTeamStats", {
        franchiseId: franchise._id,
        seasonId,
        gameId,
        teamId,
        stats: { totalYds, passYds: 240, rushYds: 110, firstDowns: 20, turnovers: 1, sacksAllowed: 2 },
      });
    }
  }
  const lastSeason = (await ctx.db.get("seasons", seasonId))!;
  return { lastGame: lastGame!, lastLines: players, lastSeason };
}

export async function insertPlayer(ctx: MutationCtx, franchise: Doc<"franchises">, name: string) {
  const [firstName = name, lastName = name] = name.split(" ");
  return await ctx.db.insert("players", {
    franchiseId: franchise._id,
    firstName,
    lastName,
    displayName: name,
    position: "WR",
    isReal: false,
    retired: false,
    aliases: [],
  });
}

export type Used = { docsRead: number; bytesRead: number; docsWritten: number };

const WRITES = new Set(["insert", "patch", "replace", "delete"]);

/** The same ctx, counting every document its `db` hands back or writes. */
export function metered(ctx: MutationCtx): { ctx: MutationCtx; used: Used } {
  const used: Used = { docsRead: 0, bytesRead: 0, docsWritten: 0 };
  const count = (result: unknown) => {
    const rows: unknown[] = Array.isArray(result)
      ? result
      : result && typeof result === "object" && "page" in result
        ? (result as { page: unknown[] }).page
        : result && typeof result === "object"
          ? [result]
          : [];
    used.docsRead += rows.length;
    for (const row of rows) used.bytesRead += JSON.stringify(row).length;
  };
  const wrap = <T extends object>(target: T): T =>
    new Proxy(target, {
      get(object, key) {
        const member: unknown = Reflect.get(object, key);
        if (typeof member !== "function") return member;
        return (...args: unknown[]) => {
          if (typeof key === "string" && WRITES.has(key)) used.docsWritten++;
          const out: unknown = (member as (...a: unknown[]) => unknown).apply(object, args);
          if (out instanceof Promise) {
            return out.then((value: unknown) => {
              count(value);
              return value;
            });
          }
          return typeof out === "object" && out !== null ? wrap(out) : out;
        };
      },
    });
  return { ctx: { ...ctx, db: wrap(ctx.db) } as MutationCtx, used };
}

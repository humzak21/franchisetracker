/// <reference types="vite/client" />
import { convexTest } from "convex-test";
import { afterEach, beforeEach, describe, expect, test, vi } from "vitest";
import { DEFAULT_QUESTION, MAX_SCAN_SEASONS, type Question } from "../../shared/stats";
import { api, internal } from "../_generated/api";
import type { Id } from "../_generated/dataModel";
import { SAMPLE_START_YEAR } from "../dev/fixtures";
import { asOwner, asStranger } from "../lib/testOwner";
import schema from "../schema";

const modules = import.meta.glob("/convex/**/*.ts");

type Asked = Omit<Partial<Question>, "playerId"> & { playerId?: Id<"players"> | null };

async function setup() {
  const t = convexTest(schema, modules);
  await t.mutation(internal.league.seed.seedTeams, {});
  await t.mutation(internal.dev.fixtures.seedFixtures, {});
  await t.mutation(internal.stats.recordBuild.start, {});
  await t.finishAllScheduledFunctions(vi.runAllTimers);
  const owner = await asOwner(t);
  const active = (await owner.query(api.franchise.franchises.getActive, {}))!;
  const ask = (over: Asked) =>
    owner.query(api.stats.explorer.run, {
      question: { ...DEFAULT_QUESTION, statKey: "passYds", ...over, playerId: over.playerId ?? null },
    });
  const player = (name: string) =>
    t.run(async (ctx) => {
      const found = await ctx.db
        .query("players")
        .withIndex("by_franchiseId_and_displayName", (q) =>
          q.eq("franchiseId", active.franchise._id).eq("displayName", name),
        )
        .first();
      return found!;
    });
  return { t, owner, ask, player };
}

const answered = <R extends { status: string }>(r: R) => r as Extract<R, { status: "answered" }>;

beforeEach(() => {
  vi.useFakeTimers();
});
afterEach(() => {
  vi.useRealTimers();
});

describe("a question", () => {
  test("reads season rows for a season list", async () => {
    const { ask } = await setup();
    const result = answered(await ask({ scope: "season" }));
    expect(result.source).toBe("seasons");
    expect(result.rows[0]?.player.name).toBe("Drake Maye");
    expect(result.rows[0]?.value).toBeGreaterThan(0);
    expect(result.rows[0]?.games).toBeGreaterThan(0);
  });

  test("a position keeps its own players", async () => {
    const { ask } = await setup();
    const result = answered(await ask({ scope: "season", position: "RB" }));
    expect(result.rows.every((r) => r.player.name !== "Drake Maye")).toBe(true);
  });

  test("reads the records board for a plain single game", async () => {
    const { ask } = await setup();
    const result = answered(await ask({ scope: "game" }));
    expect(result.source).toBe("board");
    expect(result.rows[0]?.gameId).not.toBeNull();
  });

  test("a split reads the games, and home and away tell apart", async () => {
    const { ask } = await setup();
    const fromYear = SAMPLE_START_YEAR;
    const home = answered(await ask({ scope: "season", split: "home", fromYear }));
    const away = answered(await ask({ scope: "season", split: "away", fromYear }));
    const whole = answered(await ask({ scope: "season", fromYear, toYear: SAMPLE_START_YEAR }));
    expect(home.source).toBe("lines");
    const value = (r: typeof home, name: string) =>
      r.rows.find((row) => row.player.name === name)?.value ?? 0;
    const [leader] = whole.rows;
    expect(value(home, "Drake Maye") + value(away, "Drake Maye")).toBeGreaterThanOrEqual(leader?.value ?? 0);
  });

  test("one player's question reads their games", async () => {
    const { ask, player } = await setup();
    const maye = await player("Drake Maye");
    const result = answered(await ask({ scope: "game", split: "home", playerId: maye._id }));
    expect(result.source).toBe("lines");
    expect(new Set(result.rows.map((r) => r.player.name))).toEqual(new Set(["Drake Maye"]));
  });

  test("marks and spans come off their boards", async () => {
    const { ask } = await setup();
    const span = answered(await ask({ scope: "span", window: 3 }));
    expect(span.source).toBe("board");
    expect(span.rows[0]?.games).toBe(3);
    const mark = answered(await ask({ scope: "mark", mark: 1000, horizon: "season" }));
    expect(mark.source).toBe("board");
    expect(mark.rows[0]?.games).toBe(mark.rows[0]?.value);
  });

  test("a question over too many seasons is refused, with what to narrow", async () => {
    const { t, ask } = await setup();
    await t.run(async (ctx) => {
      const franchise = (await ctx.db.query("franchises").first())!;
      for (let i = 1; i <= MAX_SCAN_SEASONS; i++) {
        await ctx.db.insert("seasons", {
          franchiseId: franchise._id,
          year: franchise.startYear + 10 + i,
          status: "upcoming",
        });
      }
    });
    const result = await ask({ scope: "game", position: "QB" });
    expect(result).toMatchObject({ status: "refused" });
    expect(
      await ask({ scope: "game", position: "QB", fromYear: SAMPLE_START_YEAR, toYear: SAMPLE_START_YEAR }),
    ).toMatchObject({
      status: "answered",
    });
  });

  test("a stat the registry does not know is an error, not an empty list", async () => {
    const { ask } = await setup();
    await expect(ask({ statKey: "nope" as Question["statKey"] })).rejects.toThrow("Unknown stat");
  });

  test("a stranger is refused", async () => {
    const { t } = await setup();
    const stranger = await asStranger(t);
    await expect(
      stranger.query(api.stats.explorer.run, {
        question: { ...DEFAULT_QUESTION, playerId: null },
      }),
    ).rejects.toThrow();
  });
});

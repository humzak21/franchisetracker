/**
 * Narrative timeline (FEATURES.md 5.7): game notes and playoff games, season notes and reports,
 * the user team's transactions and awards, and Hall of Fame inductions, as one story.
 */
import { v, type Infer } from "convex/values";
import { AWARD_INFO, TRANSACTION_LABELS, weekLabel } from "../../shared/domain";
import { userScore } from "../../shared/games/summary";
import { TIMELINE_KINDS, sortTimeline, type TimelineAt } from "../../shared/history/timeline";
import type { Doc, Id } from "../_generated/dataModel";
import { query, type QueryCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { activeFranchise, playersById, teamsById } from "../lib/franchise";
import { franchiseSeasonList, reportFor, seasonGames } from "../lib/reports";
import { literals, vGameResult, vWeekKey } from "../lib/validators";

/** Seasons read when no single season is picked; older ones load on request. */
const DEFAULT_SEASONS = 5;
const MAX_SEASONS = 50;
const MAX_ROWS = 300;
const MAX_HOF = 300;

const vAt = v.union(v.literal("start"), v.literal("end"), vWeekKey);

const vEntry = v.object({
  id: v.string(),
  kind: literals(TIMELINE_KINDS),
  year: v.number(),
  at: vAt,
  order: v.optional(v.number()),
  title: v.string(),
  body: v.optional(v.string()),
  when: v.string(),
  result: v.optional(vGameResult),
  gameId: v.optional(v.id("games")),
  playerId: v.optional(v.id("players")),
});

type Entry = Infer<typeof vEntry>;

const whenLabel = (at: TimelineAt) =>
  at === "start" ? "Before the season" : at === "end" ? "Season's end" : weekLabel(at, "long");
const text = (s: string | undefined) => (s?.trim() ? s.trim() : undefined);

async function seasonEntries(
  ctx: QueryCtx,
  season: Doc<"seasons">,
  userTeamId: Id<"teams">,
  teams: Map<Id<"teams">, Doc<"teams">>,
): Promise<Entry[]> {
  const [games, report, txs, awards] = await Promise.all([
    seasonGames(ctx, season._id),
    reportFor(ctx, season._id),
    ctx.db
      .query("transactions")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", season._id))
      .take(MAX_ROWS),
    ctx.db
      .query("awards")
      .withIndex("by_seasonId_and_type", (q) => q.eq("seasonId", season._id))
      .take(MAX_ROWS),
  ]);
  const ownTxs = txs.filter((tx) => tx.teamId === undefined || tx.teamId === userTeamId);
  const ownAwards = awards.filter((a) => a.teamId === userTeamId);
  const players = await playersById(ctx, [
    ...ownTxs.flatMap((tx) =>
      [...tx.playersIn, ...tx.playersOut].flatMap((p) => (p.playerId ? [p.playerId] : [])),
    ),
    ...ownAwards.flatMap((a) => (a.playerId ? [a.playerId] : [])),
  ]);
  const name = (ref: { playerId?: Id<"players">; rawName?: string }) =>
    (ref.playerId && players.get(ref.playerId)?.displayName) || ref.rawName || "";
  const year = season.year;
  const out: Entry[] = [];
  const push = (entry: Omit<Entry, "year" | "when">) =>
    out.push({ ...entry, year, when: whenLabel(entry.at) });

  for (const game of games) {
    const score = userScore(game);
    const notes = text(game.notes);
    if (!score || (!notes && !game.playoffRound)) continue;
    const opponent = game.opponentTeamId ? teams.get(game.opponentTeamId)?.abbr : undefined;
    push({
      id: game._id,
      kind: "game",
      at: game.weekKey,
      title:
        `${game.result ?? ""} ${score.us}–${score.them}${game.overtime ? " OT" : ""} ${game.userIsHome ? "vs" : "at"} ${opponent ?? "?"}`.trim(),
      body: notes,
      result: game.result,
      gameId: game._id,
    });
  }
  const reportText: [string, string | undefined, TimelineAt, number][] = [
    ["Pre-season report", report?.preseasonThoughts, "start", 0],
    ["Season notes", season.notes, "start", 1],
    ["Around the league", report?.aroundTheLeague, "end", 1],
    ["Post-season report", report?.postseasonThoughts, "end", 2],
  ];
  for (const [title, body, at, order] of reportText) {
    if (text(body))
      push({ id: `${season._id}:${title}`, kind: "season", at, order, title, body: text(body) });
  }
  for (const tx of ownTxs) {
    const names = [...tx.playersIn, ...tx.playersOut].map(name).filter(Boolean);
    push({
      id: tx._id,
      kind: "transaction",
      at: tx.weekKey ?? "start",
      order: 5,
      title: [TRANSACTION_LABELS[tx.type], names.join(", ")].filter(Boolean).join(": "),
      body: text(tx.notes),
      playerId: tx.playersIn[0]?.playerId ?? tx.playersOut[0]?.playerId,
    });
  }
  for (const award of ownAwards) {
    const label =
      award.type === "custom" ? (award.customName ?? AWARD_INFO.custom.label) : AWARD_INFO[award.type].label;
    push({
      id: award._id,
      kind: "award",
      at: award.weekKey ?? "end",
      title: [label, name(award)].filter(Boolean).join(": "),
      body: text(award.notes) ?? text(award.statLine),
      playerId: award.playerId,
    });
  }
  return out;
}

/** The story, newest season first. One season when `seasonId` is given, else the latest few. */
export const list = query({
  args: { seasonId: v.optional(v.id("seasons")), seasonsLimit: v.optional(v.number()) },
  returns: v.object({
    entries: v.array(vEntry),
    seasons: v.array(v.object({ _id: v.id("seasons"), year: v.number() })),
    hasOlder: v.boolean(),
  }),
  handler: async (ctx, { seasonId, seasonsLimit }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const own = (await franchiseSeasonList(ctx, franchise._id))
      .filter((s) => s.year >= franchise.startYear)
      .sort((a, b) => b.year - a.year);
    const limit = Math.min(Math.max(1, Math.floor(seasonsLimit ?? DEFAULT_SEASONS)), MAX_SEASONS);
    const picked = seasonId ? own.filter((s) => s._id === seasonId) : own.slice(0, limit);
    const teams = await teamsById(ctx);
    const entries = (
      await Promise.all(picked.map((s) => seasonEntries(ctx, s, franchise.userTeamId, teams)))
    ).flat();

    const years = new Set(picked.map((s) => s.year));
    const newest = own[0]?.year;
    const inducted = await ctx.db
      .query("hofEntries")
      .withIndex("by_franchiseId_and_inductedYear", (q) => q.eq("franchiseId", franchise._id))
      .take(MAX_HOF);
    const hofPlayers = await playersById(
      ctx,
      inducted.flatMap((e) => (e.playerId ? [e.playerId] : [])),
    );
    for (const entry of inducted) {
      // A class inducted after the last season played sits with the newest season.
      const year = newest !== undefined && entry.inductedYear > newest ? newest : entry.inductedYear;
      if (!years.has(year)) continue;
      const name = (entry.playerId && hofPlayers.get(entry.playerId)?.displayName) || entry.staffName || "";
      entries.push({
        id: entry._id,
        kind: "hof",
        year,
        at: "end",
        order: 9,
        title: `Hall of Fame: ${name}`,
        body: text(entry.blurb),
        when: `Class of ${entry.inductedYear}`,
        playerId: entry.playerId,
      });
    }
    return {
      entries: sortTimeline(entries),
      seasons: own.map((s) => ({ _id: s._id, year: s.year })),
      hasOlder: !seasonId && own.length > picked.length,
    };
  },
});

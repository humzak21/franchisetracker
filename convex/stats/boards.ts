/**
 * Reads and writes for the records books (`shared/stats/recordBoards.ts`): boards merged as rows
 * arrive, each list ranked with its typed entries, and every player's placements kept in step so
 * his page reads them with one indexed query.
 */
import {
  mergeEntries,
  rankList,
  RECORD_TOP,
  type BoardBook,
  type RankedEntry,
  type RecordBook,
  type RecordScope,
} from "../../shared/stats";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { playersById } from "../lib/franchise";
import type { Split } from "./load";

export type BoardEntry = Doc<"recordBoards">["top"][number];
export type ListKey = { split: Split; scope: RecordScope; statKey: string };
export type BoardUpdate = ListKey & { book: BoardBook; entries: BoardEntry[] };

/** Typed entries per list: a handful at most. */
const MAX_TYPED = 50;
/** A list's placements, with room for ties and players listed twice (two great seasons). */
const MAX_PLACEMENTS = 60;

export async function readBoard(
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  book: BoardBook,
  { split, scope, statKey }: ListKey,
) {
  return await ctx.db
    .query("recordBoards")
    .withIndex("by_franchiseId_and_book_and_split_and_scope_and_statKey", (q) =>
      q
        .eq("franchiseId", franchiseId)
        .eq("book", book)
        .eq("split", split)
        .eq("scope", scope)
        .eq("statKey", statKey),
    )
    .unique();
}

/**
 * Merges new entries into their boards, several updates to one list at once, and returns the
 * lists that changed. Entries are trimmed to the board's size, so callers may pass everything.
 */
export async function mergeBoards(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  updates: readonly BoardUpdate[],
): Promise<(ListKey & { book: BoardBook })[]> {
  const grouped = new Map<string, BoardUpdate>();
  for (const u of updates) {
    const key = `${u.book}|${u.split}|${u.scope}|${u.statKey}`;
    const prior = grouped.get(key);
    grouped.set(key, prior ? { ...prior, entries: [...prior.entries, ...u.entries] } : u);
  }
  const changed: (ListKey & { book: BoardBook })[] = [];
  for (const { book, split, scope, statKey, entries } of grouped.values()) {
    const board = await readBoard(ctx, franchiseId, book, { split, scope, statKey });
    const top = mergeEntries(board?.top ?? [], entries, scope);
    if (board && JSON.stringify(board.top) === JSON.stringify(top)) continue;
    if (board) await ctx.db.patch("recordBoards", board._id, { top });
    else if (top.length > 0)
      await ctx.db.insert("recordBoards", { franchiseId, book, split, scope, statKey, top });
    else continue;
    changed.push({ book, split, scope, statKey });
  }
  return changed;
}

export async function typedFor(ctx: QueryCtx, franchiseId: Id<"franchises">, book: BoardBook, key: ListKey) {
  return await ctx.db
    .query("typedRecords")
    .withIndex("by_franchiseId_and_book_and_split_and_scope_and_statKey", (q) =>
      q
        .eq("franchiseId", franchiseId)
        .eq("book", book)
        .eq("split", key.split)
        .eq("scope", key.scope)
        .eq("statKey", key.statKey),
    )
    .take(MAX_TYPED);
}

/**
 * One list as shown, top twenty: the franchise-era book from its `records` row (every entry
 * with the user team), the others from their board with typed entries merged in.
 */
export async function rankedList(
  ctx: QueryCtx,
  franchise: Doc<"franchises">,
  book: RecordBook,
  key: ListKey,
): Promise<RankedEntry<Id<"typedRecords">>[]> {
  if (book === "franchise") {
    const record = await ctx.db
      .query("records")
      .withIndex("by_franchiseId_and_split_and_scope_and_statKey", (q) =>
        q
          .eq("franchiseId", franchise._id)
          .eq("split", key.split)
          .eq("scope", key.scope)
          .eq("statKey", key.statKey),
      )
      .unique();
    const top = (record?.top ?? []).map((e) => ({ ...e, teamId: franchise.userTeamId }));
    return rankList<Id<"typedRecords">>(top, [], key.scope, () => undefined);
  }
  const [board, typed] = await Promise.all([
    readBoard(ctx, franchise._id, book, key),
    typedFor(ctx, franchise._id, book, key),
  ]);
  const computed = board?.top ?? [];
  // Names only matter for matching a typed entry without a player to a computed one.
  const players = typed.some((t) => !t.playerId)
    ? await playersById(
        ctx,
        computed.map((e) => e.playerId),
      )
    : new Map<Id<"players">, Doc<"players">>();
  return rankList(
    computed,
    typed,
    key.scope,
    (id) => players.get(id as Id<"players">)?.displayName,
    RECORD_TOP,
  );
}

/** Rewrites one list's placements from the list as shown, touching only what moved. */
export async function writePlacements(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  book: RecordBook,
  key: ListKey,
): Promise<void> {
  const ranked = await rankedList(ctx, franchise, book, key);
  const desired = new Map<
    string,
    Omit<
      Doc<"recordPlacements">,
      "_id" | "_creationTime" | "franchiseId" | "book" | "split" | "scope" | "statKey"
    >
  >(
    ranked.flatMap((e) =>
      e.playerId
        ? [
            [
              `${e.playerId}|${e.year ?? ""}`,
              {
                playerId: e.playerId as Id<"players">,
                rank: e.rank,
                value: e.value,
                year: e.year,
                firstYear: e.firstYear,
              },
            ] as const,
          ]
        : [],
    ),
  );
  const existing = await ctx.db
    .query("recordPlacements")
    .withIndex("by_franchiseId_and_book_and_split_and_scope_and_statKey", (q) =>
      q
        .eq("franchiseId", franchise._id)
        .eq("book", book)
        .eq("split", key.split)
        .eq("scope", key.scope)
        .eq("statKey", key.statKey),
    )
    .take(MAX_PLACEMENTS);
  for (const row of existing) {
    const id = `${row.playerId}|${row.year ?? ""}`;
    const want = desired.get(id);
    desired.delete(id);
    if (!want) await ctx.db.delete("recordPlacements", row._id);
    else if (want.rank !== row.rank || want.value !== row.value || want.firstYear !== row.firstYear) {
      await ctx.db.patch("recordPlacements", row._id, {
        rank: want.rank,
        value: want.value,
        firstYear: want.firstYear,
      });
    }
  }
  for (const want of desired.values()) {
    await ctx.db.insert("recordPlacements", { franchiseId: franchise._id, book, ...key, ...want });
  }
}

/** What can resolve an offseason need: the user team's transactions and draft picks, with labels. */
import { pickLabel, transactionLabel } from "../../shared/seasons/summary";
import type { Doc, Id } from "../_generated/dataModel";
import type { QueryCtx } from "../_generated/server";
import { playersById } from "./franchise";

/** A season's transaction log and draft class fit well under these. */
const MAX_TRANSACTIONS = 300;
const MAX_PICKS = 300;

type Need = Doc<"seasonReports">["needs"][number];

function txLabel(tx: Doc<"transactions">, players: Map<Id<"players">, Doc<"players">>): string {
  const names = [...tx.playersIn, ...tx.playersOut]
    .map((p) => (p.playerId && players.get(p.playerId)?.displayName) || p.rawName || "")
    .filter(Boolean);
  return transactionLabel(tx.type, tx.weekKey, names);
}

function playerIdsOf(txs: readonly Doc<"transactions">[], picks: readonly Doc<"draftPicks">[]) {
  return [
    ...txs.flatMap((tx) =>
      [...tx.playersIn, ...tx.playersOut].flatMap((p) => (p.playerId ? [p.playerId] : [])),
    ),
    ...picks.flatMap((pick) => (pick.playerId ? [pick.playerId] : [])),
  ];
}

function describe(
  txs: readonly Doc<"transactions">[],
  picks: readonly Doc<"draftPicks">[],
  players: Map<Id<"players">, Doc<"players">>,
) {
  return {
    transactions: txs.map((tx) => ({ _id: tx._id, label: txLabel(tx, players), notes: tx.notes })),
    draftPicks: picks.map((pick) => ({
      _id: pick._id,
      label: pickLabel(
        pick.round,
        pick.overall,
        (pick.playerId && players.get(pick.playerId)?.displayName) || pick.rawName,
      ),
      notes: pick.notes,
    })),
  };
}

/** Labels for the transactions and draft picks that resolved these needs, keyed by need. */
export async function resolutionLabels(ctx: QueryCtx, needs: readonly Need[]) {
  const txs = (
    await Promise.all(
      needs.map((n) =>
        n.resolvedByTransactionId ? ctx.db.get("transactions", n.resolvedByTransactionId) : null,
      ),
    )
  ).filter((d) => d !== null);
  const picks = (
    await Promise.all(
      needs.map((n) => (n.resolvedByDraftPickId ? ctx.db.get("draftPicks", n.resolvedByDraftPickId) : null)),
    )
  ).filter((d) => d !== null);
  const { transactions, draftPicks } = describe(txs, picks, await playersById(ctx, playerIdsOf(txs, picks)));
  return needs.flatMap((need) => {
    const label =
      transactions.find((t) => t._id === need.resolvedByTransactionId)?.label ??
      draftPicks.find((p) => p._id === need.resolvedByDraftPickId)?.label;
    return label ? [{ key: need.key, label }] : [];
  });
}

/** The user team's transactions and draft picks in these seasons, newest season first. */
export async function resolutionCandidates(
  ctx: QueryCtx,
  seasonIds: readonly Id<"seasons">[],
  userTeamId: Id<"teams">,
) {
  const txs: Doc<"transactions">[] = [];
  const picks: Doc<"draftPicks">[] = [];
  for (const seasonId of seasonIds) {
    const seasonTxs = await ctx.db
      .query("transactions")
      .withIndex("by_seasonId_and_weekKey", (q) => q.eq("seasonId", seasonId))
      .take(MAX_TRANSACTIONS);
    // A league-wide log has other teams' moves; one without a team is the user's own.
    txs.push(...seasonTxs.filter((tx) => tx.teamId === undefined || tx.teamId === userTeamId));
    const seasonPicks = await ctx.db
      .query("draftPicks")
      .withIndex("by_seasonId_and_overall", (q) => q.eq("seasonId", seasonId))
      .take(MAX_PICKS);
    picks.push(...seasonPicks.filter((pick) => pick.teamId === userTeamId));
  }
  return describe(txs, picks, await playersById(ctx, playerIdsOf(txs, picks)));
}

/** Extraction spend per month: added to as runs finish, read before each new one starts. */
import { budgetLevel, usageMonth } from "../../shared/ingestion/budget";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

const monthRow = async (ctx: QueryCtx, franchiseId: Id<"franchises">, month: string) =>
  await ctx.db
    .query("usageMonths")
    .withIndex("by_franchiseId_and_month", (q) => q.eq("franchiseId", franchiseId).eq("month", month))
    .unique();

export async function monthSpend(ctx: QueryCtx, franchiseId: Id<"franchises">) {
  return (await monthRow(ctx, franchiseId, usageMonth(Date.now())))?.costUsd ?? 0;
}

export async function addUsage(ctx: MutationCtx, franchiseId: Id<"franchises">, costUsd = 0) {
  const month = usageMonth(Date.now());
  const row = await monthRow(ctx, franchiseId, month);
  if (row) {
    await ctx.db.patch("usageMonths", row._id, {
      costUsd: row.costUsd + costUsd,
      extractions: row.extractions + 1,
    });
  } else await ctx.db.insert("usageMonths", { franchiseId, month, costUsd, extractions: 1 });
}

export async function budgetSpent(ctx: QueryCtx, franchise: Doc<"franchises">) {
  const budget = franchise.settings.monthlyBudgetUsd;
  return budget ? budgetLevel(await monthSpend(ctx, franchise._id), budget) === "over" : false;
}

/** Each maintenance job's latest run per franchise, written by the jobs themselves. */
import type { MaintenanceJob } from "../../shared/ops/maintenance";
import type { Doc, Id } from "../_generated/dataModel";
import type { MutationCtx, QueryCtx } from "../_generated/server";

export const runRow = async (ctx: QueryCtx, franchiseId: Id<"franchises">, job: MaintenanceJob) =>
  await ctx.db
    .query("maintenanceRuns")
    .withIndex("by_franchiseId_and_job", (q) => q.eq("franchiseId", franchiseId).eq("job", job))
    .unique();

async function saveRun(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  job: MaintenanceJob,
  fields: Pick<Doc<"maintenanceRuns">, "status" | "summary" | "startedAt" | "finishedAt">,
) {
  const row = await runRow(ctx, franchiseId, job);
  if (row) await ctx.db.patch("maintenanceRuns", row._id, fields);
  else await ctx.db.insert("maintenanceRuns", { franchiseId, job, ...fields });
}

export const beginRun = (ctx: MutationCtx, franchiseId: Id<"franchises">, job: MaintenanceJob) =>
  saveRun(ctx, franchiseId, job, {
    status: "running",
    summary: undefined,
    startedAt: Date.now(),
    finishedAt: undefined,
  });

export async function finishRun(
  ctx: MutationCtx,
  franchiseId: Id<"franchises">,
  job: MaintenanceJob,
  summary: string,
) {
  const startedAt = (await runRow(ctx, franchiseId, job))?.startedAt ?? Date.now();
  await saveRun(ctx, franchiseId, job, { status: "done", summary, startedAt, finishedAt: Date.now() });
}

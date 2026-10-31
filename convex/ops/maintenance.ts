/**
 * Settings → Maintenance (`shared/ops/maintenance.ts`): each job's latest run, and running one,
 * for the active franchise. Jobs that can show what they would do preview before they run.
 */
import { v } from "convex/values";
import { weekLabel, type WeekKey } from "../../shared/domain";
import { counted, MAINTENANCE_INFO, MAINTENANCE_JOBS, type JobOutcome } from "../../shared/ops/maintenance";
import { DEFAULT_KEEP_DAYS, KEEP_OPTIONS } from "../../shared/ops/retention";
import { internal } from "../_generated/api";
import { mutation, query } from "../_generated/server";
import { clearStarLines } from "../games/clearTypedStarLines";
import { fixNames } from "../ingestion/fixMisreads";
import { repairTeams } from "../ingestion/repairSeasonStatsTeams";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { beginRun, finishRun, runRow } from "../lib/maintenanceRuns";
import { literals } from "../lib/validators";
import { startRecordBuild } from "../stats/recordBuild";
import { screenshotsDue } from "./retention";

const vJob = literals(MAINTENANCE_JOBS);
const vOutcome = v.object({ count: v.number(), summary: v.string(), lines: v.array(v.string()) });

const starOutcome = (rows: Awaited<ReturnType<typeof clearStarLines>>): JobOutcome => ({
  count: rows.length,
  summary: counted(rows.length, "caption"),
  lines: rows.map((r) => `${r.year} ${weekLabel(r.weekKey as WeekKey)}: ${r.caption}`),
});

function teamsOutcome({ moved, unresolved }: Awaited<ReturnType<typeof repairTeams>>): JobOutcome {
  const unknown = unresolved.length > 0 ? `, ${unresolved.length} with no team to go to` : "";
  return {
    count: moved.length,
    summary: `${counted(moved.length, "line")} to move${unknown}`,
    lines: [
      ...moved.map((m) => `${m.name}, ${m.year}: to ${m.to}`),
      ...unresolved.map((u) => `${u.name}, ${u.year}: no team known, so it stays`),
    ],
  };
}

/** What a job would do, changing nothing. */
export const preview = mutation({
  args: { job: vJob },
  returns: vOutcome,
  handler: async (ctx, { job }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    if (job === "starLines") return starOutcome(await clearStarLines(ctx, true));
    if (job === "seasonStatsTeams") return teamsOutcome(await repairTeams(ctx, { dryRun: true }));
    if (job === "screenshots") return await screenshotsDue(ctx, franchise);
    throw invalid(`${MAINTENANCE_INFO[job].label} has no preview`);
  },
});

export const run = mutation({
  args: { job: vJob },
  returns: v.null(),
  handler: async (ctx, { job }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const franchiseId = franchise._id;
    if (job === "rebuildStats") {
      await startRecordBuild(ctx, franchiseId, "logs");
      return null;
    }
    await beginRun(ctx, franchiseId, job);
    if (job === "teamTotals") {
      await ctx.scheduler.runAfter(0, internal.stats.teamTotals.rebuildFranchise, { franchiseId });
    } else if (job === "screenshots") {
      await ctx.scheduler.runAfter(0, internal.ops.retention.tidyFranchise, { franchiseId });
    } else if (job === "starLines") {
      await finishRun(ctx, franchiseId, job, starOutcome(await clearStarLines(ctx, false)).summary);
    } else {
      const { moved } = await repairTeams(ctx, { dryRun: false });
      await finishRun(ctx, franchiseId, job, `Moved ${counted(moved.length, "line")}`);
    }
    return null;
  },
});

const vRun = v.object({
  status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
  summary: v.union(v.string(), v.null()),
  at: v.number(),
});

/** Every job's latest run, and how long screenshots are kept. */
export const status = query({
  args: {},
  returns: v.object({
    jobs: v.array(v.object({ job: vJob, last: v.union(vRun, v.null()) })),
    keepDays: v.number(),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const build = await ctx.db
      .query("recordBuilds")
      .withIndex("by_franchiseId", (q) => q.eq("franchiseId", franchise._id))
      .first();
    const jobs = await Promise.all(
      MAINTENANCE_JOBS.map(async (job) => {
        if (job === "rebuildStats") {
          const at = build?.finishedAt ?? build?.startedAt;
          const summary = build?.status === "running" ? build.phase : null;
          return { job, last: build && at ? { status: build.status, summary, at } : null };
        }
        const row = await runRow(ctx, franchise._id, job);
        const last = row
          ? { status: row.status, summary: row.summary ?? null, at: row.finishedAt ?? row.startedAt }
          : null;
        return { job, last };
      }),
    );
    return { jobs, keepDays: franchise.settings.keepScreenshotsDays ?? DEFAULT_KEEP_DAYS };
  },
});

export const setKeepDays = mutation({
  args: { days: v.number() },
  returns: v.null(),
  handler: async (ctx, { days }) => {
    await requireOwner(ctx);
    if (!KEEP_OPTIONS.some((o) => o.value === days)) throw invalid("Pick one of the retention choices");
    const franchise = await activeFranchise(ctx);
    await ctx.db.patch("franchises", franchise._id, {
      settings: { ...franchise.settings, keepScreenshotsDays: days },
    });
    return null;
  },
});

/** Fixes a name a season stats screen misread: a preview says what it found, then it applies. */
export const fixMisread = mutation({
  args: {
    dryRun: v.boolean(),
    year: v.number(),
    name: v.string(),
    into: v.optional(v.string()),
    teamAbbr: v.string(),
  },
  returns: v.object({
    mode: v.union(v.literal("merge"), v.literal("move"), v.literal("place"), v.null()),
    problem: v.union(v.string(), v.null()),
    done: v.boolean(),
  }),
  handler: async (ctx, { dryRun, year, ...fix }) => {
    await requireOwner(ctx);
    const [row] = await fixNames(ctx, { dryRun, year, fixes: [fix] });
    if (!row) throw invalid("Nothing to fix");
    return { mode: row.mode, problem: row.skipped, done: row.done };
  },
});

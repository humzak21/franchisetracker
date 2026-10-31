import { defineTable } from "convex/server";
import { v } from "convex/values";
import { MAINTENANCE_JOBS } from "../../shared/ops/maintenance";
import { literals } from "../lib/validators";

/** Running the app rather than the franchise: error reports and backups (FEATURES.md 8). */
export const opsTables = {
  /**
   * Errors the app hit, in the browser or in a scheduled job, one row per distinct error (by
   * fingerprint) with a count. Bounded: the oldest are pruned past a cap.
   */
  errorReports: defineTable({
    fingerprint: v.string(),
    kind: v.union(v.literal("render"), v.literal("error"), v.literal("rejection"), v.literal("scheduled")),
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.string(),
    userAgent: v.optional(v.string()),
    count: v.number(),
    firstSeen: v.number(),
    lastSeen: v.number(),
    /** When the owner marked it seen; happening again after this makes it new again. */
    seenAt: v.optional(v.number()),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_lastSeen", ["lastSeen"]),

  /** Each maintenance job's latest run per franchise (`shared/ops/maintenance.ts`). */
  maintenanceRuns: defineTable({
    franchiseId: v.id("franchises"),
    job: literals(MAINTENANCE_JOBS),
    status: v.union(v.literal("running"), v.literal("done"), v.literal("failed")),
    summary: v.optional(v.string()),
    startedAt: v.number(),
    finishedAt: v.optional(v.number()),
  }).index("by_franchiseId_and_job", ["franchiseId", "job"]),

  /** What extraction has cost per month, added to as runs finish so the budget is one read. */
  usageMonths: defineTable({
    franchiseId: v.id("franchises"),
    /** "2026-10" (`shared/ingestion/budget.ts`). */
    month: v.string(),
    costUsd: v.number(),
    extractions: v.number(),
  }).index("by_franchiseId_and_month", ["franchiseId", "month"]),

  /** Full backups of every franchise as gzipped JSON in file storage, nightly and on demand. */
  backups: defineTable({
    kind: v.union(v.literal("scheduled"), v.literal("manual")),
    storageId: v.id("_storage"),
    bytes: v.number(),
    /** Rows per table. */
    counts: v.record(v.string(), v.number()),
    franchises: v.array(v.string()),
    createdAt: v.number(),
  }).index("by_kind_and_createdAt", ["kind", "createdAt"]),
};

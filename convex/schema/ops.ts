import { defineTable } from "convex/server";
import { v } from "convex/values";

/** Running the app rather than the franchise: error reports and backups (FEATURES.md 8). */
export const opsTables = {
  /**
   * Errors the app hit in the browser, one row per distinct error (by fingerprint) with a count.
   * Bounded: the oldest are pruned past a cap.
   */
  errorReports: defineTable({
    fingerprint: v.string(),
    kind: v.union(v.literal("render"), v.literal("error"), v.literal("rejection")),
    message: v.string(),
    stack: v.optional(v.string()),
    path: v.string(),
    userAgent: v.optional(v.string()),
    count: v.number(),
    firstSeen: v.number(),
    lastSeen: v.number(),
  })
    .index("by_fingerprint", ["fingerprint"])
    .index("by_lastSeen", ["lastSeen"]),

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

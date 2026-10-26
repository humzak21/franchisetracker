import { defineTable } from "convex/server";
import { v } from "convex/values";
import { vScalar, vUploadSource, vUploadStatus, vWarningSeverity, vWeekKey } from "../lib/validators";

export const ingestionTables = {
  uploads: defineTable({
    franchiseId: v.id("franchises"),
    storageId: v.id("_storage"),
    mime: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    source: vUploadSource,
    /** Ingestion target registry key (`shared/ingestion/targets.ts`); absent until tagged. */
    targetKey: v.optional(v.string()),
    seasonId: v.optional(v.id("seasons")),
    weekKey: v.optional(vWeekKey),
    /** Pre-tagged game from an "Import screenshot" button. */
    gameId: v.optional(v.id("games")),
    /** Groups multi-image targets (a box score across several screenshots). */
    setKey: v.optional(v.string()),
    status: vUploadStatus,
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_franchiseId_and_status", ["franchiseId", "status"])
    .index("by_franchiseId_and_setKey", ["franchiseId", "setKey"])
    .index("by_gameId", ["gameId"]),

  extractions: defineTable({
    franchiseId: v.id("franchises"),
    uploadId: v.id("uploads"),
    targetKey: v.string(),
    model: v.string(),
    /** Model output verbatim. */
    rawJson: v.string(),
    /** Normalized draft; its shape is the target's JSON schema in `shared/ingestion`. */
    draft: v.any(),
    confidence: v.array(v.object({ path: v.string(), value: v.number() })),
    warnings: v.array(
      v.object({ path: v.optional(v.string()), message: v.string(), severity: vWarningSeverity }),
    ),
    tokenUsage: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
        costUsd: v.optional(v.number()),
      }),
    ),
    latencyMs: v.optional(v.number()),
  }).index("by_uploadId", ["uploadId"]),

  /** User fixes to extracted fields; feed few-shot examples. */
  corrections: defineTable({
    franchiseId: v.id("franchises"),
    targetKey: v.string(),
    fieldPath: v.string(),
    extractedValue: vScalar,
    correctedValue: vScalar,
    uploadId: v.optional(v.id("uploads")),
    extractionId: v.optional(v.id("extractions")),
    imageCrop: v.optional(
      v.object({
        storageId: v.optional(v.id("_storage")),
        x: v.number(),
        y: v.number(),
        width: v.number(),
        height: v.number(),
      }),
    ),
    usedAsExample: v.boolean(),
  })
    .index("by_franchiseId_and_targetKey_and_usedAsExample", ["franchiseId", "targetKey", "usedAsExample"])
    .index("by_extractionId", ["extractionId"]),

  /** Hashed bearer tokens for the Apple Shortcut endpoint. */
  ingestionTokens: defineTable({
    franchiseId: v.id("franchises"),
    tokenHash: v.string(),
    label: v.optional(v.string()),
    createdAt: v.number(),
    lastUsedAt: v.optional(v.number()),
    revokedAt: v.optional(v.number()),
  })
    .index("by_tokenHash", ["tokenHash"])
    .index("by_franchiseId", ["franchiseId"]),
};

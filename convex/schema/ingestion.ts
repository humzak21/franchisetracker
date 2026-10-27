import { defineTable } from "convex/server";
import { v } from "convex/values";
import { vDraft, vDraftWarning, vFieldConfidence, vTargetKey } from "../lib/draftValidators";
import { vScalar, vUploadSource, vUploadStatus, vWeekKey } from "../lib/validators";

export const ingestionTables = {
  uploads: defineTable({
    franchiseId: v.id("franchises"),
    storageId: v.id("_storage"),
    mime: v.string(),
    width: v.optional(v.number()),
    height: v.optional(v.number()),
    source: vUploadSource,
    /** Ingestion target registry key (`shared/ingestion/targets.ts`); absent until tagged. */
    targetKey: v.optional(vTargetKey),
    seasonId: v.optional(v.id("seasons")),
    weekKey: v.optional(vWeekKey),
    /** Pre-tagged game from an "Import screenshot" button; set on commit to the game written. */
    gameId: v.optional(v.id("games")),
    /**
     * Groups the screenshots extracted together (a box score across several screens). Every
     * upload has one; a lone screenshot is a set of one keyed by its own id.
     */
    setKey: v.optional(v.string()),
    status: vUploadStatus,
    /**
     * When the current extraction run started. It names the run: an answer or a timeout from a
     * run that was stopped or restarted since no longer matches and is dropped.
     */
    extractionStartedAt: v.optional(v.number()),
    error: v.optional(v.string()),
    createdAt: v.number(),
  })
    .index("by_franchiseId", ["franchiseId"])
    .index("by_franchiseId_and_status", ["franchiseId", "status"])
    .index("by_franchiseId_and_setKey", ["franchiseId", "setKey"])
    .index("by_gameId", ["gameId"]),

  extractions: defineTable({
    franchiseId: v.id("franchises"),
    /** The set's first upload; `setKey` ties the extraction to every screenshot it read. */
    uploadId: v.id("uploads"),
    setKey: v.string(),
    targetKey: vTargetKey,
    model: v.string(),
    /** Model output verbatim. */
    rawJson: v.string(),
    /** Normalized draft as extracted (`shared/ingestion/types.ts`); corrections diff against it. */
    draft: vDraft,
    /** The draft with the user's review edits so far, saved as they go so a review survives a reload. */
    reviewDraft: v.optional(vDraft),
    confidence: v.array(vFieldConfidence),
    warnings: v.array(vDraftWarning),
    tokenUsage: v.optional(
      v.object({
        prompt: v.number(),
        completion: v.number(),
        total: v.number(),
        costUsd: v.optional(v.number()),
      }),
    ),
    latencyMs: v.optional(v.number()),
  })
    .index("by_franchiseId", ["franchiseId"])
    .index("by_uploadId", ["uploadId"])
    .index("by_setKey", ["setKey"]),

  /** User fixes to extracted fields; feed few-shot examples. */
  corrections: defineTable({
    franchiseId: v.id("franchises"),
    targetKey: vTargetKey,
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

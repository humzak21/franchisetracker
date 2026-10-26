/** Upload set helpers shared by the inbox, review, extraction and Shortcut functions. */
import { INGESTION_TARGETS, isTargetKey } from "../../shared/ingestion/targets";
import type { Doc, Id } from "../_generated/dataModel";
import { internal } from "../_generated/api";
import type { MutationCtx, QueryCtx } from "../_generated/server";
import { invalid, must } from "../lib/errors";

/** A box score is a handful of screens; more than this in one set is a mistake. */
export const MAX_SET_SIZE = 20;

export async function setUploads(
  ctx: QueryCtx,
  franchiseId: Id<"franchises">,
  setKey: string,
): Promise<Doc<"uploads">[]> {
  return await ctx.db
    .query("uploads")
    .withIndex("by_franchiseId_and_setKey", (q) => q.eq("franchiseId", franchiseId).eq("setKey", setKey))
    .take(MAX_SET_SIZE);
}

export async function requireSet(ctx: QueryCtx, franchiseId: Id<"franchises">, setKey: string) {
  const uploads = await setUploads(ctx, franchiseId, setKey);
  return must(uploads[0] ? uploads : null, "Upload set");
}

/**
 * Context an extraction needs: a target, and where it goes by the target's scope: a game (or a
 * season and week) for game screens, a season and week for weekly ones, a season for the rest.
 */
export function readyToExtract(upload: Doc<"uploads">): boolean {
  if (upload.targetKey === undefined || !isTargetKey(upload.targetKey)) return false;
  if (upload.gameId !== undefined) return true;
  if (upload.seasonId === undefined) return false;
  return INGESTION_TARGETS[upload.targetKey].scope === "season" || upload.weekKey !== undefined;
}

/** Marks a set as extracting and schedules the extraction action. */
export async function startExtraction(
  ctx: MutationCtx,
  uploads: readonly Doc<"uploads">[],
  model?: string,
): Promise<void> {
  const first = uploads[0];
  if (!first?.setKey) throw invalid("Nothing to extract");
  if (!readyToExtract(first)) throw invalid("Tag the screenshots with what they show and when first");
  if (uploads.some((u) => u.status === "committed")) throw invalid("This set is already committed");
  for (const upload of uploads) {
    await ctx.db.patch("uploads", upload._id, { status: "extracting", error: undefined });
  }
  await ctx.scheduler.runAfter(0, internal.ingestion.extract.run, { setKey: first.setKey, model });
}

/** The status a set shows: the least advanced of its uploads' statuses. */
const STATUS_ORDER = ["failed", "queued", "extracting", "review", "rejected", "committed"] as const;
export function setStatus(uploads: readonly Doc<"uploads">[]): Doc<"uploads">["status"] {
  return STATUS_ORDER.find((s) => uploads.some((u) => u.status === s)) ?? "queued";
}

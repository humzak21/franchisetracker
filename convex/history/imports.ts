/**
 * Settings → Real NFL history: the import's progress, a refresh that reruns it, and the
 * earlier-years import for a franchise imported before coverage reached back to 1999.
 */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { appError } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import schema from "../schema";
import { importFor, startEarlierImport, startImport } from "./importJob";

export const status = query({
  args: {},
  returns: v.union(v.null(), schema.doc("historyImports")),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    return await importFor(ctx, franchise._id);
  },
});

/** Reruns the import. Everything it writes is an upsert, so a refresh never duplicates a row. */
export const refresh = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    if (!(await startImport(ctx, franchise._id))) throw appError("conflict", "The import is already running");
    return null;
  },
});

/** Adds the seasons nflverse covers before the franchise's first imported one, keeping the rest. */
export const importEarlier = mutation({
  args: {},
  returns: v.null(),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const started = await startEarlierImport(ctx, franchise._id);
    if (started === "running") throw appError("conflict", "The import is already running");
    if (started === "up_to_date") throw appError("invalid", "Every season nflverse covers is imported");
    return null;
  },
});

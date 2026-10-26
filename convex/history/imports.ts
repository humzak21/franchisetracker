/** Settings → Real NFL history: the import's progress, and a refresh that reruns it. */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { appError } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import schema from "../schema";
import { importFor, startImport } from "./importJob";

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

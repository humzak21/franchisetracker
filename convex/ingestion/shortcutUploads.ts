/**
 * The Shortcut endpoint's write path; the HTTP action has already checked the bearer token.
 * Shortcuts posts one image per request, so the screens of one box score arrive as a batch: a
 * set keyed by the batch that starts extracting when the last of its screenshots lands.
 */
import { v } from "convex/values";
import { INGESTION_TARGETS } from "../../shared/ingestion/targets";
import { internalMutation } from "../_generated/server";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { readyToExtract, setUploads, startExtraction } from "./sets";
import { insertUploads, vContext } from "./uploads";

export const create = internalMutation({
  args: {
    storageIds: v.array(v.id("_storage")),
    ...vContext,
    /** Requests sharing `key` form one set of `size` screenshots. */
    batch: v.optional(v.object({ key: v.string(), size: v.number() })),
  },
  returns: v.array(v.string()),
  handler: async (ctx, { batch, ...args }) => {
    const grouped = args.targetKey !== undefined && INGESTION_TARGETS[args.targetKey].multiImage;
    // Screens read one by one (or still untagged) are a set each, batch or not.
    if (!batch || !grouped) return await insertUploads(ctx, { ...args, source: "shortcut" });

    const franchise = await activeFranchise(ctx);
    const setKey = `batch:${batch.key}`;
    const earlier = await setUploads(ctx, franchise._id, setKey);
    if (earlier.some((u) => u.status !== "queued"))
      throw invalid("This batch was already read; send a new one");
    if (earlier.length + args.storageIds.length > batch.size) {
      throw invalid(`The batch holds ${batch.size} screenshots`);
    }
    await insertUploads(ctx, { ...args, source: "shortcut", setKey, deferExtraction: true });
    const uploads = await setUploads(ctx, franchise._id, setKey);
    if (uploads.length === batch.size && readyToExtract(uploads[0]!)) await startExtraction(ctx, uploads);
    return [setKey];
  },
});

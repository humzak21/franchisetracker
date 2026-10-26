/** Extraction settings: OpenRouter status, model choices, and where the Shortcut posts. */
import { v } from "convex/values";
import { mutation, query } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { testModeEnabled } from "../lib/owner";
import { openRouterKey } from "../external/openrouter";
import { DEFAULT_MODELS, modelSettings } from "./models";

const vModels = v.object({ primary: v.string(), fallback: v.string() });
/** OpenRouter ids look like `vendor/model-name`, optionally with a `:variant`. */
const MODEL_ID = /^[\w.-]+\/[\w.:-]+$/;

export const get = query({
  args: {},
  returns: v.object({
    openRouterConfigured: v.boolean(),
    /** No key but a local test deployment: extraction answers with the built-in fixture. */
    fixtureMode: v.boolean(),
    models: vModels,
    defaults: vModels,
    shortcutUrl: v.union(v.string(), v.null()),
  }),
  handler: async (ctx) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    const configured = openRouterKey() !== undefined;
    const { primary, fallback } = modelSettings(franchise);
    const site = process.env.CONVEX_SITE_URL;
    return {
      openRouterConfigured: configured,
      fixtureMode: !configured && testModeEnabled(),
      models: { primary, fallback },
      defaults: { primary: DEFAULT_MODELS.primary, fallback: DEFAULT_MODELS.fallback },
      shortcutUrl: site ? `${site}/shortcut/upload` : null,
    };
  },
});

export const setModels = mutation({
  args: vModels,
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const primary = args.primary.trim();
    const fallback = args.fallback.trim();
    if (!MODEL_ID.test(primary) || !MODEL_ID.test(fallback)) {
      throw invalid("Model ids look like vendor/model, as listed on openrouter.ai/models");
    }
    const franchise = await activeFranchise(ctx);
    await ctx.db.patch("franchises", franchise._id, {
      settings: { ...franchise.settings, models: { ...franchise.settings.models, primary, fallback } },
    });
    return null;
  },
});

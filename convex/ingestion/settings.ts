/** Extraction settings: OpenRouter status, model choices and presets, and where the Shortcut posts. */
import { v } from "convex/values";
import type { Doc } from "../_generated/dataModel";
import { mutation, query, type MutationCtx } from "../_generated/server";
import { requireOwner } from "../lib/auth";
import { invalid } from "../lib/errors";
import { activeFranchise } from "../lib/franchise";
import { testModeEnabled } from "../lib/owner";
import { openRouterKey } from "../external/openrouter";
import { DEFAULT_MODELS, MAX_PRESETS, modelPresets, modelSettings } from "./models";

const vModels = v.object({ primary: v.string(), fallback: v.string() });
/** OpenRouter ids look like `vendor/model-name`, optionally with a `:variant`. */
const MODEL_ID = /^[\w.-]+\/[\w.:-]+$/;

function modelId(raw: string): string {
  const model = raw.trim();
  if (!MODEL_ID.test(model)) {
    throw invalid("Model ids look like vendor/model, as listed on openrouter.ai/models");
  }
  return model;
}

type SavedModels = NonNullable<Doc<"franchises">["settings"]["models"]>;

async function patchModels(
  ctx: MutationCtx,
  franchise: Doc<"franchises">,
  update: (saved: SavedModels) => SavedModels,
) {
  const settings = franchise.settings;
  await ctx.db.patch("franchises", franchise._id, {
    settings: { ...settings, models: update(settings.models ?? {}) },
  });
}

/** Adds models to the saved presets, skipping defaults and ones already there. */
function withPresets(saved: SavedModels, models: string[]): string[] {
  const builtIn: string[] = [DEFAULT_MODELS.primary, DEFAULT_MODELS.fallback];
  const presets = [...(saved.presets ?? [])];
  for (const model of models) if (!builtIn.includes(model) && !presets.includes(model)) presets.push(model);
  if (presets.length > MAX_PRESETS) throw invalid(`Keep at most ${MAX_PRESETS} saved models`);
  return presets;
}

export const get = query({
  args: {},
  returns: v.object({
    openRouterConfigured: v.boolean(),
    /** No key but a local test deployment: extraction answers with the built-in fixture. */
    fixtureMode: v.boolean(),
    models: vModels,
    defaults: vModels,
    presets: v.array(v.object({ model: v.string(), saved: v.boolean() })),
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
      presets: modelPresets(franchise),
      shortcutUrl: site ? `${site}/shortcut/upload` : null,
    };
  },
});

/** Saves the primary and fallback models; a model not yet among the presets is added to them. */
export const setModels = mutation({
  args: vModels,
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const primary = modelId(args.primary);
    const fallback = modelId(args.fallback);
    const franchise = await activeFranchise(ctx);
    await patchModels(ctx, franchise, (saved) => ({
      ...saved,
      primary,
      fallback,
      presets: withPresets(saved, [primary, fallback]),
    }));
    return null;
  },
});

export const addPreset = mutation({
  args: { model: v.string() },
  returns: v.null(),
  handler: async (ctx, args) => {
    await requireOwner(ctx);
    const model = modelId(args.model);
    const franchise = await activeFranchise(ctx);
    await patchModels(ctx, franchise, (saved) => ({ ...saved, presets: withPresets(saved, [model]) }));
    return null;
  },
});

/** Removes a saved preset. The primary or fallback in use stays in the pickers until changed. */
export const removePreset = mutation({
  args: { model: v.string() },
  returns: v.null(),
  handler: async (ctx, { model }) => {
    await requireOwner(ctx);
    const franchise = await activeFranchise(ctx);
    await patchModels(ctx, franchise, (saved) => ({
      ...saved,
      presets: (saved.presets ?? []).filter((m) => m !== model),
    }));
    return null;
  },
});

/** Extraction model settings: franchise overrides on top of these defaults (Settings → Models). */
import type { Doc } from "../_generated/dataModel";

/** Strong vision models with structured output on OpenRouter as of late 2026; editable in Settings. */
export const DEFAULT_MODELS = {
  primary: "google/gemini-4-argon",
  fallback: "anthropic/claude-sonnet-5.5",
  temperature: 0,
  maxTokens: 16_000,
} as const;

export type ModelSettings = { primary: string; fallback: string; temperature: number; maxTokens: number };

export function modelSettings(franchise: Doc<"franchises">): ModelSettings {
  const saved = franchise.settings.models ?? {};
  return {
    primary: saved.primary ?? DEFAULT_MODELS.primary,
    fallback: saved.fallback ?? DEFAULT_MODELS.fallback,
    temperature: saved.temperature ?? DEFAULT_MODELS.temperature,
    maxTokens: saved.maxTokens ?? DEFAULT_MODELS.maxTokens,
  };
}

/** Saved presets a franchise keeps at most; the pickers stay a short list. */
export const MAX_PRESETS = 30;

/**
 * The models the pickers offer, defaults first, then saved presets, then whatever is in use if
 * it was saved before presets existed. `saved` marks the ones the user can remove.
 */
export function modelPresets(franchise: Doc<"franchises">): { model: string; saved: boolean }[] {
  const saved = franchise.settings.models?.presets ?? [];
  const { primary, fallback } = modelSettings(franchise);
  const out = new Map<string, boolean>();
  for (const model of [DEFAULT_MODELS.primary, DEFAULT_MODELS.fallback]) out.set(model, false);
  for (const model of saved) if (!out.has(model)) out.set(model, true);
  for (const model of [primary, fallback]) if (!out.has(model)) out.set(model, false);
  return [...out].map(([model, isSaved]) => ({ model, saved: isSaved }));
}

/** The model label stored on extractions produced without OpenRouter on a local test deployment. */
export const FIXTURE_MODEL = "local/fixture";

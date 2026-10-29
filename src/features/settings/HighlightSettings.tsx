import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
  DEFAULT_GAME_TIERS,
  DEFAULT_SEASON_THRESHOLDS,
  getStat,
  isStatKey,
  type StatKey,
  type ThresholdOverrides,
  type TierThreshold,
} from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { StatCell } from "@/components/data/StatCell";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

type Scale = "season" | "game";

/** What each scale edits: its defaults, where its overrides live, and how it is described. */
const SCALES = {
  season: {
    defaults: DEFAULT_SEASON_THRESHOLDS,
    title: "Highlights",
    description: "Season numbers at or past a tier are highlighted in every table.",
    save: "Save highlights",
    labelPrefix: "",
  },
  game: {
    defaults: DEFAULT_GAME_TIERS,
    title: "Game highlights",
    description: "One player's numbers in a single game, highlighted in box scores and game logs.",
    save: "Save game highlights",
    labelPrefix: "Single-game ",
  },
} as const satisfies Record<Scale, object>;

const statsOf = (scale: Scale) => Object.keys(SCALES[scale].defaults).filter(isStatKey);

/** Only stats that differ from the defaults are saved, so defaults keep improving for the rest. */
function changedFrom(scale: Scale, values: Record<string, TierThreshold>): ThresholdOverrides {
  const defaults: ThresholdOverrides = SCALES[scale].defaults;
  const out: ThresholdOverrides = {};
  for (const key of statsOf(scale)) {
    const value = values[key];
    const fallback = defaults[key];
    if (value && (value.tier1 !== fallback?.tier1 || value.tier2 !== fallback?.tier2)) out[key] = value;
  }
  return out;
}

/**
 * Highlight thresholds per stat (FEATURES.md 5.5 and 5.12), two tiers, previewed in place: on the
 * season scale for season tables, or the single-game scale for box scores and game logs.
 */
export function HighlightSettings({ scale }: { scale: Scale }) {
  const active = useFranchise();
  const save = useMutation(api.franchise.settings.setThresholds);
  const { defaults, title, description, labelPrefix } = SCALES[scale];
  const fallback: ThresholdOverrides = defaults;
  const stats = statsOf(scale);
  const settings = active?.franchise.settings;
  const saved = ((scale === "game" ? settings?.gameThresholdOverrides : settings?.thresholdOverrides) ??
    {}) as ThresholdOverrides;
  const [values, setValues] = useState<Record<string, TierThreshold>>(() =>
    Object.fromEntries(stats.map((k) => [k, saved[k] ?? fallback[k] ?? { tier1: 0 }])),
  );
  const [message, setMessage] = useState<{ ok: boolean; text: string } | null>(null);
  // The inputs are uncontrolled while typing; restoring defaults remounts them with the new values.
  const [version, setVersion] = useState(0);

  const set = (key: StatKey, tier: "tier1" | "tier2", text: string) => {
    const n = Number(text);
    if (text.trim() === "" || !Number.isFinite(n)) return;
    setValues((v) => ({ ...v, [key]: { ...v[key], tier1: v[key]?.tier1 ?? 0, [tier]: n } }));
  };
  const submit = async (next: Record<string, TierThreshold>) => {
    setMessage(null);
    try {
      await save({ scale, overrides: changedFrom(scale, next) });
      setMessage({ ok: true, text: "Saved" });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, "Could not save the thresholds.") });
    }
  };

  return (
    <Section title={title} description={description} variant="card">
      <div className="@container">
        <ul key={version} className="divide-y divide-border">
          {stats.map((key) => {
            const value = values[key];
            return (
              <li
                key={key}
                className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 py-2 @md:grid-cols-[1fr_6rem_6rem_7rem]"
              >
                <span className="truncate text-sm">{getStat(key).label}</span>
                <Input
                  aria-label={`${labelPrefix}${getStat(key).label} tier 1`}
                  inputMode="decimal"
                  defaultValue={value?.tier1}
                  onChange={(e) => set(key, "tier1", e.target.value)}
                  className="num text-right"
                />
                <Input
                  aria-label={`${labelPrefix}${getStat(key).label} tier 2`}
                  inputMode="decimal"
                  defaultValue={value?.tier2}
                  onChange={(e) => set(key, "tier2", e.target.value)}
                  className="num text-right"
                />
                <span className="hidden justify-end gap-1.5 @md:flex">
                  <StatCell
                    stat={key}
                    value={value?.tier1}
                    highlight={scale === "game" ? "game" : true}
                    thresholds={values as ThresholdOverrides}
                  />
                  {value?.tier2 !== undefined && (
                    <StatCell
                      stat={key}
                      value={value.tier2}
                      highlight={scale === "game" ? "game" : true}
                      thresholds={values as ThresholdOverrides}
                    />
                  )}
                </span>
              </li>
            );
          })}
        </ul>
        <div className="mt-3 flex flex-wrap items-center gap-3">
          <Button variant="primary" size="sm" onClick={() => void submit(values)}>
            {SCALES[scale].save}
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const defaults = Object.fromEntries(stats.map((k) => [k, fallback[k] ?? { tier1: 0 }]));
              setValues(defaults);
              setVersion((n) => n + 1);
              void submit(defaults);
            }}
          >
            Restore defaults
          </Button>
          {message && (
            <span className={message.ok ? "text-sm text-win" : "text-sm text-loss"} aria-live="polite">
              {message.text}
            </span>
          )}
        </div>
      </div>
    </Section>
  );
}

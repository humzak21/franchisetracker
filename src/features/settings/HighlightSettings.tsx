import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import {
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

const STATS = Object.keys(DEFAULT_SEASON_THRESHOLDS).filter(isStatKey);

/** Only stats that differ from the defaults are saved, so defaults keep improving for the rest. */
function changedFrom(values: Record<string, TierThreshold>): ThresholdOverrides {
  const out: ThresholdOverrides = {};
  for (const key of STATS) {
    const value = values[key];
    const fallback = DEFAULT_SEASON_THRESHOLDS[key];
    if (value && (value.tier1 !== fallback?.tier1 || value.tier2 !== fallback?.tier2)) out[key] = value;
  }
  return out;
}

/** Elite highlight thresholds per stat (FEATURES.md 5.5 and 5.12), two tiers, previewed in place. */
export function HighlightSettings() {
  const active = useFranchise();
  const save = useMutation(api.franchise.settings.setThresholds);
  const saved = (active?.franchise.settings.thresholdOverrides ?? {}) as ThresholdOverrides;
  const [values, setValues] = useState<Record<string, TierThreshold>>(() =>
    Object.fromEntries(STATS.map((k) => [k, saved[k] ?? DEFAULT_SEASON_THRESHOLDS[k] ?? { tier1: 0 }])),
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
      await save({ overrides: changedFrom(next) });
      setMessage({ ok: true, text: "Saved" });
    } catch (err) {
      setMessage({ ok: false, text: errorMessage(err, "Could not save the thresholds.") });
    }
  };

  return (
    <Section
      title="Highlights"
      description="Season numbers at or past a tier are highlighted in every table."
      variant="card"
    >
      <div className="@container">
        <ul key={version} className="divide-y divide-border">
          {STATS.map((key) => {
            const value = values[key];
            return (
              <li
                key={key}
                className="grid grid-cols-[1fr_5rem_5rem] items-center gap-2 py-2 @md:grid-cols-[1fr_6rem_6rem_7rem]"
              >
                <span className="truncate text-sm">{getStat(key).label}</span>
                <Input
                  aria-label={`${getStat(key).label} tier 1`}
                  inputMode="decimal"
                  defaultValue={value?.tier1}
                  onChange={(e) => set(key, "tier1", e.target.value)}
                  className="num text-right"
                />
                <Input
                  aria-label={`${getStat(key).label} tier 2`}
                  inputMode="decimal"
                  defaultValue={value?.tier2}
                  onChange={(e) => set(key, "tier2", e.target.value)}
                  className="num text-right"
                />
                <span className="hidden justify-end gap-1.5 @md:flex">
                  <StatCell
                    stat={key}
                    value={value?.tier1}
                    highlight
                    thresholds={values as ThresholdOverrides}
                  />
                  {value?.tier2 !== undefined && (
                    <StatCell
                      stat={key}
                      value={value.tier2}
                      highlight
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
            Save highlights
          </Button>
          <Button
            variant="ghost"
            size="sm"
            onClick={() => {
              const defaults = Object.fromEntries(
                STATS.map((k) => [k, DEFAULT_SEASON_THRESHOLDS[k] ?? { tier1: 0 }]),
              );
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

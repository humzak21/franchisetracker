import { MapPin } from "lucide-react";
import { WEEK_KEYS, weekLabel, type WeekKey } from "@shared/domain";
import { INGESTION_TARGETS, SCOPE_LABELS, TARGET_KEYS, type TargetKey } from "@shared/ingestion/targets";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";

export type CaptureFieldsValue<S extends string> = {
  targetKey: TargetKey | null;
  seasonId: S | null;
  weekKey: WeekKey | null;
};

type CaptureFieldsProps<S extends string> = {
  seasons: readonly { _id: S; year: number }[];
  value: CaptureFieldsValue<S>;
  onChange: (next: CaptureFieldsValue<S>) => void;
  /** Offer "Tag later" so screenshots can be captured first and sorted in the inbox. */
  allowUntagged?: boolean;
  /** The game these screenshots belong to; replaces the season and week pickers. */
  game?: string;
  className?: string;
};

const SCOPE_ORDER = ["game", "week", "season"] as const;
const labelClass = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";
const UNTAGGED = "later";

/** Season screens (standings, leaders) are filed under the season alone. */
const needsWeek = (target: TargetKey | null) =>
  target === null || INGESTION_TARGETS[target].scope !== "season";

/**
 * What a set of screenshots is and where it goes: target, season and, unless it is a season
 * screen, week. Inbox, capture sheet and tag sheet. Targets are grouped by what they cover.
 */
export function CaptureFields<S extends string>({
  seasons,
  value,
  onChange,
  allowUntagged = false,
  game,
  className,
}: CaptureFieldsProps<S>) {
  const targets = [
    ...[...TARGET_KEYS]
      .sort(
        (a, b) =>
          SCOPE_ORDER.indexOf(INGESTION_TARGETS[a].scope) - SCOPE_ORDER.indexOf(INGESTION_TARGETS[b].scope),
      )
      .map((key) => ({
        value: key as string,
        label: INGESTION_TARGETS[key].label,
        group: SCOPE_LABELS[INGESTION_TARGETS[key].scope],
      })),
    ...(allowUntagged ? [{ value: UNTAGGED, label: "Tag later" }] : []),
  ];
  const week = needsWeek(value.targetKey);
  return (
    <div className={cn("space-y-4", className)}>
      <div className="space-y-1.5">
        <span className={labelClass}>Screen</span>
        <Select
          aria-label="Screen"
          value={value.targetKey ?? UNTAGGED}
          onValueChange={(next) =>
            onChange({ ...value, targetKey: next === UNTAGGED ? null : (next as TargetKey) })
          }
          options={targets}
        />
        <p className="text-xs text-muted-foreground">
          {value.targetKey
            ? INGESTION_TARGETS[value.targetKey].description
            : "Upload now, pick what it is from the inbox later."}
        </p>
        {value.targetKey && (
          <p className="flex items-start gap-1.5 text-xs">
            <MapPin className="mt-px size-3.5 shrink-0 text-primary" />
            <span>
              <span className="font-medium">Goes to</span> {INGESTION_TARGETS[value.targetKey].goesTo}
            </span>
          </p>
        )}
      </div>
      {game ? (
        <p className="rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className={labelClass}>Game</span> <span className="ml-2 font-medium">{game}</span>
        </p>
      ) : (
        <div className={cn("grid gap-3", week ? "grid-cols-2" : "grid-cols-1")}>
          <label className="space-y-1.5">
            <span className={labelClass}>Season</span>
            <Select
              aria-label="Season"
              value={value.seasonId ?? ""}
              placeholder="Season"
              onValueChange={(id) => onChange({ ...value, seasonId: id as S })}
              options={seasons.map((s) => ({ value: s._id, label: String(s.year) }))}
            />
          </label>
          {week && (
            <label className="space-y-1.5">
              <span className={labelClass}>Week</span>
              <Select
                aria-label="Week"
                value={value.weekKey ?? ""}
                placeholder="Week"
                onValueChange={(week) => onChange({ ...value, weekKey: week as WeekKey })}
                options={WEEK_KEYS.map((key) => ({ value: key, label: weekLabel(key, "long") }))}
              />
            </label>
          )}
        </div>
      )}
    </div>
  );
}

/** True when the fields say enough to extract: a target, and a game or a season (and week, unless a season screen). */
export function captureReady<S extends string>(value: CaptureFieldsValue<S>, game?: string): boolean {
  if (value.targetKey === null) return false;
  if (game !== undefined) return true;
  return value.seasonId !== null && (value.weekKey !== null || !needsWeek(value.targetKey));
}

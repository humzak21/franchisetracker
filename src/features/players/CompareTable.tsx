import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { X } from "lucide-react";
import type { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { leaders } from "@shared/players/compare";
import {
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  formatStat,
  statValue,
  type StatKey,
  type StatLine,
} from "@shared/stats";
import { PlayerCard } from "@/components/player/PlayerCard";
import { cn } from "@/lib/cn";

export type ComparePlayer = FunctionReturnType<typeof api.players.compare.get>[number];
type Split = "regular" | "postseason";

const RAIL = "sticky left-0 z-10 bg-surface";

/**
 * Players as columns, stats as rows. On a phone the columns scroll sideways under a sticky stat
 * label rail and snap one player at a time; on a wide screen every column fits.
 */
export function CompareTable({
  players,
  stats,
  split,
  onRemove,
}: {
  players: readonly ComparePlayer[];
  stats: readonly StatKey[];
  split: Split;
  onRemove: (id: Id<"players">) => void;
}) {
  const careers = players.map((p) => ({ games: p[split].games, totals: p[split].totals as StatLine }));
  const lead = leaders(stats, careers);
  const grid = { gridTemplateColumns: `7.5rem repeat(${players.length}, minmax(9.5rem, 1fr))` };

  return (
    <div
      className="snap-x snap-mandatory scroll-pl-[7.5rem] overflow-x-auto rounded-xl border border-border bg-surface"
      data-swipe-ignore
    >
      <div className="grid min-w-full" style={grid} aria-label="Comparison" role="group">
        <div className={cn(RAIL, "border-b border-border")} />
        {players.map((p) => (
          <div key={p.playerId} className="relative snap-start border-b border-border px-3 pt-3 pb-3">
            <Link
              to="/players/$playerId"
              params={{ playerId: p.playerId }}
              aria-label={p.displayName}
              className="mx-auto block max-w-40"
            >
              <PlayerCard
                player={{
                  displayName: p.displayName,
                  position: p.position,
                  headshotUrl: p.headshotUrl,
                  team: p.team ?? undefined,
                }}
                caption={p.firstYear ? `${p.firstYear}–${p.lastYear}` : undefined}
              />
            </Link>
            <button
              type="button"
              onClick={() => onRemove(p.playerId)}
              aria-label={`Remove ${p.displayName}`}
              className="absolute top-1 right-1 grid size-8 place-items-center rounded-full text-muted-foreground hover:bg-surface-2 hover:text-foreground pointer-coarse:size-11"
            >
              <X className="size-4" />
            </button>
          </div>
        ))}
        <Cell rail label="Seasons" />
        {players.map((p) => (
          <Cell key={p.playerId} value={String(p[split].seasons)} />
        ))}
        <Cell rail label="Games" />
        {players.map((p) => (
          <Cell key={p.playerId} value={String(p[split].games)} />
        ))}
        {stats.map((key, index) => {
          const def = STAT_REGISTRY[key];
          const previous = stats[index - 1];
          const heading =
            !previous || STAT_REGISTRY[previous].category !== def.category
              ? STAT_CATEGORY_LABELS[def.category]
              : null;
          return [
            heading && (
              <div
                key={`${key}-heading`}

                className="col-span-full border-t border-border bg-surface-2 px-3 py-1.5 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase"
              >
                <span className={cn(RAIL, "bg-transparent")}>{heading}</span>
              </div>
            ),
            <Cell key={`${key}-label`} rail label={def.label} abbr={def.abbr} />,
            ...players.map((p, i) => {
              const v = statValue(key, p[split].totals as StatLine, { games: p[split].games });
              return (
                <Cell
                  key={`${key}-${p.playerId}`}
                  value={v === null ? "—" : formatStat(key, v)}
                  best={lead.get(key) === i}
                />
              );
            }),
          ];
        })}
      </div>
    </div>
  );
}

function Cell({
  rail,
  label,
  abbr,
  value,
  best,
}: {
  rail?: boolean;
  label?: string;
  abbr?: string;
  value?: string;
  best?: boolean;
}) {
  if (rail) {
    return (
      <div
        className={cn(RAIL, "flex min-h-10 items-center border-t border-border px-3 text-sm")}
        title={label}
      >
        <span className="truncate">
          <span className="font-semibold">{abbr ?? label}</span>
          {abbr && <span className="ml-1.5 text-xs text-muted-foreground">{label}</span>}
        </span>
      </div>
    );
  }
  return (
    <div className="flex min-h-10 items-center justify-end border-t border-border px-3">
      <span
        className={cn(
          "num rounded-[5px] px-1.5 py-px text-[15px]",
          best && "bg-elite-1 font-semibold text-primary",
        )}
      >
        {value}
      </span>
    </div>
  );
}

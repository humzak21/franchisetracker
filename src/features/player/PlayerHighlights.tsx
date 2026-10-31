import { useState, type ComponentProps } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel } from "@shared/domain";
import {
  formatStat,
  isStatKey,
  RECORD_BOOK_LABELS,
  RECORD_SCOPE_LABELS,
  STAT_REGISTRY,
  STREAK_LABELS,
  type StreakKey,
} from "@shared/stats";
import { FactChip } from "@/components/data/FactChip";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";

/** Placements shown before "Show all": a star quarterback makes dozens of lists. */
const SHOWN = 12;

type Chip = ComponentProps<typeof FactChip> & { id: string; rank: number };

const statLabel = (key: string) => (isStatKey(key) ? STAT_REGISTRY[key].label : key);
const statNumber = (key: string, value: number) => (isStatKey(key) ? formatStat(key, value) : value);
const place = (rank: number, of: string) => `${rank === 1 ? "Record" : `#${rank}`} · ${of}`;
const playoffs = (split: string) => (split === "postseason" ? ", playoffs" : "");

/**
 * Every records list the player makes (top twenty of the team, franchise-era and all-time books,
 * and the best spans) and his streaks, each at its longest so a run that ended stays on his page.
 * Hidden until there is one of any.
 */
export function PlayerHighlights({ playerId }: { playerId: Id<"players"> }) {
  const placements = useQuery(api.stats.records.forPlayer, { playerId });
  const spans = useQuery(api.stats.spans.forPlayer, { playerId });
  const streaks = useQuery(api.stats.streaks.forPlayer, { playerId });
  const [all, setAll] = useState(false);
  if (!placements || !spans || !streaks) return null;
  const places: Chip[] = [
    ...placements.map((p) => {
      const span = p.firstYear !== null && p.firstYear !== p.year ? `${p.firstYear}–${p.year}` : p.year;
      const week = p.weekKey ? ` ${weekLabel(p.weekKey)}` : "";
      return {
        id: p._id,
        rank: p.rank,
        active: p.rank === 1,
        value: statNumber(p.statKey, p.value),
        label: place(p.rank, statLabel(p.statKey)),
        detail: `${RECORD_BOOK_LABELS[p.book]} · ${RECORD_SCOPE_LABELS[p.scope].toLowerCase()}${playoffs(p.split)}${span ? ` · ${span}${week}` : ""}`,
      };
    }),
    ...spans.map((s) => ({
      id: `${s.split}-${s.statKey}-${s.window}`,
      rank: s.rank,
      active: s.rank === 1,
      value: statNumber(s.statKey, s.value),
      label: place(s.rank, statLabel(s.statKey)),
      detail: `Any ${s.window} games${playoffs(s.split)} · ${s.span}`,
    })),
  ].sort((a, b) => a.rank - b.rank);
  if (places.length === 0 && streaks.length === 0) return null;
  const shown = all ? places : places.slice(0, SHOWN);

  return (
    <Section title="Records and streaks">
      <div className="flex flex-wrap gap-2">
        {shown.map(({ id, rank: _rank, ...chip }) => (
          <FactChip key={id} {...chip} />
        ))}
        {streaks.map((s) => (
          <FactChip
            key={s.key}
            active={s.current >= 2}
            value={s.longest}
            label={`Longest: ${STREAK_LABELS[s.key as StreakKey] ?? s.key}`}
            detail={
              s.current >= 2
                ? `Running now: ${s.current}${s.since ? `, since ${s.since}` : ""}`
                : (s.span ?? "Ended")
            }
          />
        ))}
      </div>
      {places.length > SHOWN && (
        <Button size="sm" variant="ghost" className="mt-2" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${places.length} records`}
        </Button>
      )}
    </Section>
  );
}

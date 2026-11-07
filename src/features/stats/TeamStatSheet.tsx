import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { TEAM_SEASON_STATS, type TeamSeasonStatKey } from "@shared/stats/teamSeasonRegistry";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Select } from "@/components/ui/select";
import { type EditablePoint, TeamStatSeasonRow } from "./TeamStatSeasonRow";

type TeamStatSheetProps = {
  statKey: TeamSeasonStatKey | null;
  onClose: () => void;
  points: readonly (EditablePoint & { year: number })[];
  seasons: readonly { _id: Id<"seasons">; year: number }[];
  /** The season on screen, listed even before it has a value. */
  year: number;
};

/**
 * Types in one stat's seasons for Stats → Team: every season with a value and the one on screen,
 * newest first, and any other season of the franchise added from the list.
 */
export function TeamStatSheet({ statKey, onClose, points, seasons, year }: TeamStatSheetProps) {
  const [added, setAdded] = useState<number[]>([]);
  const byYear = new Map(points.map((p) => [p.year, p]));
  const shown = new Set([year, ...points.map((p) => p.year), ...added]);
  const listed = seasons.filter((s) => shown.has(s.year)).sort((a, b) => b.year - a.year);
  const addable = seasons.filter((s) => !shown.has(s.year)).sort((a, b) => b.year - a.year);
  const close = (open: boolean) => {
    if (open) return;
    setAdded([]);
    onClose();
  };

  return (
    <BottomSheet
      open={statKey !== null}
      onOpenChange={close}
      title={statKey ? TEAM_SEASON_STATS[statKey].label : "Team stat"}
      description="Your team's figure and league rank (5 or T-5) by season. A saved figure replaces the one worked out from the games until you go back to them."
    >
      {statKey && (
        <div className="divide-y divide-border">
          {listed.map((season) => {
            const point = byYear.get(season.year) ?? null;
            return (
              <TeamStatSeasonRow
                // Remounts with the saved values, so the inputs show what was stored.
                key={`${season.year}-${point?.source}-${point?.value}-${point?.rank}-${point?.tied}`}
                statKey={statKey}
                seasonId={season._id}
                year={season.year}
                point={point}
              />
            );
          })}
          {addable.length > 0 && (
            <div className="pt-3">
              <Select
                aria-label="Add a season"
                placeholder="Add a season…"
                value=""
                options={addable.map((s) => ({ value: String(s.year), label: String(s.year) }))}
                onValueChange={(value) => setAdded((prev) => [...prev, Number(value)])}
              />
            </div>
          )}
        </div>
      )}
    </BottomSheet>
  );
}

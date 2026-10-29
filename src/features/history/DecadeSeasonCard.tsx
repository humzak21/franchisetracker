import { Pencil } from "lucide-react";
import type { Doc } from "@convex/_generated/dataModel";
import { finishTiers } from "@shared/history/seasonRecord";
import { formatOrdinal, formatRecord } from "@shared/stats";
import { Highlight } from "@/components/data/Highlight";
import { StaffLine } from "@/components/team/StaffLine";
import { Button } from "@/components/ui/button";
import { PlayoffFinish } from "./PlayoffFinish";
import { RealBadge } from "./RealBadge";

/** One season of a decade on a phone: record, finish, staff and note, opening the season or its editor. */
export function DecadeSeasonCard({
  season,
  real,
  onOpen,
  onEdit,
}: {
  season: Doc<"seasons">;
  real: boolean;
  onOpen: () => void;
  onEdit: () => void;
}) {
  const r = season.userRecord;
  return (
    <article className="relative rounded-xl border border-border bg-surface">
      <button type="button" onClick={onOpen} className="w-full p-4 text-left">
        <div className="flex items-center justify-between gap-3 pr-10 pointer-coarse:pr-12">
          <span className="inline-flex items-center gap-2">
            <span className="num font-display text-2xl font-bold">{season.year}</span>
            {real && <RealBadge />}
          </span>
          <span className="num font-display text-2xl font-bold">{r ? formatRecord(r) : "—"}</span>
        </div>
        <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
          {r?.divisionRank && (
            <Highlight tier={finishTiers(r).division}>{formatOrdinal(r.divisionRank)} in division</Highlight>
          )}
          {r && <PlayoffFinish year={season.year} record={r} />}
        </div>
        <StaffLine staff={season.coaching} className="mt-2 text-xs" />
        {season.notes && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{season.notes}</p>}
      </button>
      <Button
        variant="ghost"
        size="icon-sm"
        aria-label={`Edit ${season.year}`}
        onClick={onEdit}
        className="absolute top-3 right-3"
      >
        <Pencil />
      </Button>
    </article>
  );
}

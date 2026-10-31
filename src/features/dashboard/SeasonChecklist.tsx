import { Link } from "@tanstack/react-router";
import { Camera, ChevronRight, Circle, CircleCheck } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  CHECKLIST_GROUP_LABELS,
  isGroupDone,
  type ChecklistGroup,
  type ChecklistItem,
} from "@shared/seasons/checklist";
import { useCapture } from "@/app/capture/CaptureProvider";
import { CoverageStrip } from "@/components/data/CoverageStrip";
import { Section } from "@/components/layout/Section";
import { Disclosure } from "@/components/ui/Disclosure";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";
import { RetirementsSheet } from "./RetirementsSheet";

const ROW =
  "flex min-h-12 w-full items-center gap-3 px-3 py-2 text-left transition-colors hover:bg-surface-2";

function ItemBody({ item, end }: { item: ChecklistItem; end: ReactNode }) {
  return (
    <>
      {item.done ? (
        <CircleCheck aria-label="Done" className="size-5 shrink-0 text-win" />
      ) : (
        <Circle
          aria-label={item.optional ? "Optional" : "To do"}
          className="size-5 shrink-0 text-subtle-foreground"
        />
      )}
      <span className="min-w-0 flex-1">
        <span className={cn("block text-sm font-medium", item.done && "text-muted-foreground")}>
          {item.label}
        </span>
        {item.detail && <span className="block text-xs text-muted-foreground">{item.detail}</span>}
      </span>
      {end}
    </>
  );
}

/** One line: done or missing, and a tap that goes to whatever fills it. */
function Item({
  item,
  year,
  onRetirements,
}: {
  item: ChecklistItem;
  year: number;
  onRetirements: () => void;
}) {
  const capture = useCapture();
  const { action } = item;
  const chevron = <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />;
  if (action.kind === "capture") {
    return (
      <button type="button" className={ROW} onClick={() => capture.open({ targetKey: action.target })}>
        <ItemBody item={item} end={<Camera className="size-4 shrink-0 text-subtle-foreground" />} />
      </button>
    );
  }
  if (action.kind === "retirements") {
    return (
      <button type="button" className={ROW} disabled={item.done} onClick={onRetirements}>
        <ItemBody item={item} end={item.done ? null : chevron} />
      </button>
    );
  }
  if (action.place === "goals" || action.place === "report") {
    return (
      <Link
        to="/history/reports/$year"
        params={{ year: String(year) }}
        hash={action.place === "goals" ? "goals" : undefined}
        className={ROW}
      >
        <ItemBody item={item} end={chevron} />
      </Link>
    );
  }
  return (
    <Link to={action.place === "roster" ? "/roster" : "/transactions"} className={ROW}>
      <ItemBody item={item} end={chevron} />
    </Link>
  );
}

function Items({
  group,
  year,
  onRetirements,
}: {
  group: ChecklistGroup;
  year: number;
  onRetirements: () => void;
}) {
  return (
    <ul className="divide-y divide-border">
      {group.items.map((item) => (
        <li key={item.key}>
          <Item item={item} year={year} onRetirements={onRetirements} />
        </li>
      ))}
    </ul>
  );
}

/**
 * The season checklist (FEATURES.md 5.1): the group the season is in, open, with the rest a tap
 * away, then the season's coverage. Done or missing comes from the data, so nothing is ticked.
 */
export function SeasonChecklist({
  seasonId,
  year,
  className,
}: {
  seasonId: Id<"seasons">;
  year: number;
  className?: string;
}) {
  const data = useQuery(api.seasons.checklist.forSeason, { seasonId });
  const [retiring, setRetiring] = useState(false);
  if (data === null) return null;
  const openRetirements = () => setRetiring(true);
  const current = data?.groups.find((g) => g.key === data.current);
  const others = data?.groups.filter((g) => g.key !== data.current) ?? [];

  return (
    <Section title="Season checklist" className={className}>
      {data === undefined || !current ? (
        <Skeleton className="h-48 rounded-xl" />
      ) : (
        <div className="space-y-3">
          <div className="overflow-hidden rounded-xl border border-border bg-surface">
            <h3 className="border-b border-border px-3 py-2 text-xs font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {CHECKLIST_GROUP_LABELS[current.key]}
            </h3>
            <Items group={current} year={year} onRetirements={openRetirements} />
          </div>
          {others.map((group) => (
            <Disclosure
              key={group.key}
              title={CHECKLIST_GROUP_LABELS[group.key]}
              count={
                isGroupDone(group) ? undefined : group.items.filter((i) => !i.done && !i.optional).length
              }
              className="[&>div]:p-0"
            >
              <Items group={group} year={year} onRetirements={openRetirements} />
            </Disclosure>
          ))}
          <CoverageStrip items={data.coverage} className="px-1 pt-1" />
          <RetirementsSheet seasonId={seasonId} open={retiring} onOpenChange={setRetiring} />
        </div>
      )}
    </Section>
  );
}

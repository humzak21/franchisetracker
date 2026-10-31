import { Segmented } from "@/components/ui/segmented";
import { BestSpanLists } from "./BestSpanLists";
import { FastestToLists } from "./FastestToLists";
import { RecordsBook } from "./RecordsBook";
import type { Split } from "./split";
import { TeamRecordLists } from "./TeamRecordLists";
import type { RecordsKind } from "./view";

const KINDS: { value: RecordsKind; label: string }[] = [
  { value: "books", label: "Players" },
  { value: "marks", label: "Fastest to" },
  { value: "spans", label: "Best spans" },
  { value: "team", label: "Team records" },
];

/** Stats → Records (FEATURES.md 5.5): the three books, fastest-to lists, best spans, the team's. */
export function RecordsView({
  kind,
  onKind,
  split,
}: {
  kind: RecordsKind;
  onKind: (kind: RecordsKind) => void;
  split: Split;
}) {
  return (
    <div className="space-y-4">
      <div data-swipe-ignore className="-mx-1 scrollbar-none overflow-x-auto px-1">
        <Segmented aria-label="Records" value={kind} onChange={onKind} options={KINDS} />
      </div>
      {kind === "books" && <RecordsBook split={split} />}
      {kind === "marks" && <FastestToLists />}
      {kind === "spans" && <BestSpanLists split={split} />}
      {kind === "team" && <TeamRecordLists split={split} />}
    </div>
  );
}

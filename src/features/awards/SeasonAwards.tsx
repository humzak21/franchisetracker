import { useMutation } from "convex/react";
import { MoreHorizontal, RotateCcw, UserRoundCheck } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { COUNTED_AWARDS, countedWinners } from "@shared/awards/counted";
import { cabinet, CABINET_AWARDS } from "@shared/awards/groups";
import { AWARD_INFO, type AwardType } from "@shared/domain";
import { Section } from "@/components/layout/Section";
import { ActionMenu } from "@/components/ui/ActionMenu";
import { Button } from "@/components/ui/button";
import { AssignAwardSheet } from "./AssignAwardSheet";
import { AwardCard } from "./AwardCard";
import type { AwardWinner, CountedAward, SeasonAward } from "./types";

const grid = "grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3";

/** One award: its winners (ties share the slot), or an empty slot waiting for one. */
function AwardSlot({
  type,
  winners,
  assigned,
  onAssign,
  onClear,
}: {
  type: AwardType;
  winners: readonly AwardWinner[];
  /** A winner is stored for the season, so clearing it is possible. */
  assigned: boolean;
  onAssign: () => void;
  onClear: () => void;
}) {
  const label = AWARD_INFO[type].label;
  const counted = AWARD_INFO[type].cadence === "counted";
  const menu = (
    <ActionMenu
      label={`${label} actions`}
      trigger={
        <Button size="icon-sm" variant="ghost" aria-label={`${label} actions`}>
          <MoreHorizontal />
        </Button>
      }
      items={[
        { id: "assign", label: "Assign winner", icon: UserRoundCheck, onSelect: onAssign },
        ...(assigned
          ? [
              {
                id: "clear",
                label: counted ? "Back to the count" : "Remove winner",
                icon: RotateCcw,
                onSelect: onClear,
              },
            ]
          : []),
      ]}
    />
  );
  if (winners.length === 0) {
    return (
      <li className="flex min-w-0 items-center justify-between gap-2 rounded-xl border border-dashed border-border p-3">
        <span className="min-w-0">
          <span className="block truncate text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            {label}
          </span>
          <span className="text-sm text-muted-foreground">No winner yet</span>
        </span>
        {menu}
      </li>
    );
  }
  return (
    <li className="min-w-0 space-y-2">
      {winners.map((w, i) => (
        <AwardCard key={`${w.name}-${i}`} award={w} action={menu} />
      ))}
    </li>
  );
}

/**
 * The season's awards (FEATURES.md 5.8): Madden's yearly awards as imported, then the awards
 * counted live from league stats and weekly awards. Any slot can be assigned by hand, which
 * overrides the import or the count.
 */
export function SeasonAwards({
  seasonId,
  awards,
  counted,
}: {
  seasonId: Id<"seasons">;
  awards: SeasonAward[];
  counted: CountedAward[] | undefined;
}) {
  const clear = useMutation(api.awards.assign.clear);
  const [assigning, setAssigning] = useState<AwardType | null>(null);
  const countedFor = (type: AwardType) => counted?.find((c) => c.type === type)?.contenders ?? [];

  const slot = ({ type, winners }: { type: AwardType; winners: SeasonAward[] }) => (
    <AwardSlot
      key={type}
      type={type}
      assigned={winners.length > 0}
      winners={winners.length > 0 ? winners : countedWinners(countedFor(type)).map((c) => ({ ...c, type }))}
      onAssign={() => setAssigning(type)}
      onClear={() => void clear({ seasonId, type })}
    />
  );

  const madden = cabinet(awards, CABINET_AWARDS);
  const sections = [
    <Section
      key="madden"
      title="Madden awards"
      description="From the end-of-season awards screens, or assigned here."
    >
      <ul className={grid}>{madden.map(slot)}</ul>
    </Section>,
    <Section
      key="counted"
      title="From the stats"
      description="League leaders across league stats and weekly awards, counted live until you assign a winner."
    >
      <ul className={grid}>{cabinet(awards, COUNTED_AWARDS).map(slot)}</ul>
    </Section>,
  ];
  // Madden names its winners after the season; until then the live count is the news.
  const maddenFirst = madden.some((s) => s.winners.length > 0);

  return (
    <div className="space-y-6">
      {maddenFirst ? sections : sections.reverse()}
      <AssignAwardSheet
        seasonId={seasonId}
        type={assigning}
        contenders={assigning ? countedFor(assigning) : []}
        onClose={() => setAssigning(null)}
      />
    </div>
  );
}

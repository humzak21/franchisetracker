import { UserRoundCheck } from "lucide-react";
import { AWARD_INFO } from "@shared/domain";
import { Disclosure } from "@/components/ui/Disclosure";
import { cn } from "@/lib/cn";
import { CONFERENCE_TONE } from "./conference";
import type { SlotKey } from "./types";

export type SlotGroup = { title: string; slots: SlotKey[] };

/** The season's awards nobody has won yet, out of the way until wanted; each can be assigned from here. */
export function UnfilledSlots({
  groups,
  onAssign,
}: {
  groups: SlotGroup[];
  onAssign: (slot: SlotKey) => void;
}) {
  const shown = groups.filter((g) => g.slots.length > 0);
  const count = shown.reduce((n, g) => n + g.slots.length, 0);
  if (count === 0) return null;
  return (
    <Disclosure title="Not awarded yet" count={count}>
      <div className="space-y-4">
        {shown.map((group) => (
          <div key={group.title} className="space-y-1.5">
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {group.title}
            </h3>
            <ul className="flex flex-wrap gap-1.5">
              {group.slots.map((slot) => (
                <li key={`${slot.type}-${slot.conference ?? ""}`}>
                  <button
                    type="button"
                    onClick={() => onAssign(slot)}
                    className="inline-flex min-h-9 items-center gap-1.5 rounded-lg border border-border bg-surface px-2.5 text-sm hover:bg-surface-2 pointer-coarse:min-h-11"
                  >
                    <UserRoundCheck className="size-3.5 text-muted-foreground" />
                    {slot.conference && (
                      <span className={cn("text-xs font-bold", CONFERENCE_TONE[slot.conference].text)}>
                        {slot.conference}
                      </span>
                    )}
                    {AWARD_INFO[slot.type].label}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        ))}
      </div>
    </Disclosure>
  );
}

import { Check, CircleCheck } from "lucide-react";
import { useState } from "react";
import { HangingJersey } from "@/components/team/HangingJersey";
import { StaffLine } from "@/components/team/StaffLine";
import { Badge } from "@/components/ui/misc";
import { SwipeRow } from "@/components/ui/SwipeRow";
import { BUF, KC, NE } from "./fixtures";
import type { Specimen } from "./specimens";

function SwipeDemo() {
  const [done, setDone] = useState<string[]>([]);
  return (
    <ul className="space-y-2">
      {["CB · High · Shutdown corner", "LT · Medium · Protect the blind side", "K · Low"].map((label) => (
        <li key={label}>
          <SwipeRow
            action={
              <>
                <CircleCheck className="size-4" /> Resolve
              </>
            }
            onAction={() => setDone((d) => [...d, label])}
            disabled={done.includes(label)}
          >
            <div className="flex min-h-12 items-center gap-2 border border-border px-3 text-sm">
              <span className="flex-1">{label}</span>
              {done.includes(label) && (
                <Badge tone="win">
                  <Check className="size-3" /> Resolved
                </Badge>
              )}
            </div>
          </SwipeRow>
        </li>
      ))}
    </ul>
  );
}

export const HISTORY_SPECIMENS: Specimen[] = [
  {
    id: "hangingjersey",
    name: "HangingJersey",
    note: "The Hall of Fame wall: a jersey on a hanger in team colors with the number and name across the back. Fills its parent's width; long names condense.",
    render: () => (
      <div className="@container">
        <div className="grid grid-cols-2 gap-6 @tablet:grid-cols-4">
          <HangingJersey team={NE} number={12} name="Brady" />
          <HangingJersey team={KC} number={15} name="Mahomes" />
          <HangingJersey team={BUF} number={34} name="Thurmanthomas" />
          <HangingJersey name="Belichick" />
        </div>
      </div>
    ),
  },
  {
    id: "staffline",
    name: "StaffLine",
    note: "A season's coaching staff and schemes on one wrapping line: season header, season card, decade grid.",
    render: () => (
      <div className="space-y-2">
        <StaffLine
          staff={{
            headCoach: "Mike Vrabel",
            offensiveCoordinator: "Josh McDaniels",
            defensiveCoordinator: "Terrell Williams",
            offensiveScheme: "West Coast",
            defensiveScheme: "4-3",
          }}
        />
        <StaffLine staff={{ headCoach: "Bill Belichick" }} />
        <StaffLine staff={undefined} empty="No staff set for this season." />
      </div>
    ),
  },
  {
    id: "swiperow",
    name: "SwipeRow",
    note: "Swipe a row left past the threshold to run its action (the needs checklist resolves this way on phones). A short swipe springs back; vertical drags scroll.",
    render: () => <SwipeDemo />,
  },
];

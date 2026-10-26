import { useState } from "react";
import { NFL_TEAMS } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PlayerChip } from "@/components/player/PlayerChip";
import { TeamPicker } from "@/components/team/TeamPicker";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { PLAYERS } from "./fixtures";

/** Stateful gallery demos for interactive primitives. */
export function SheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button onClick={() => setOpen(true)}>Open bottom sheet</Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Pick a player"
        description="Bottom sheets hold pickers and toolbars on phones."
        footer={
          <Button variant="primary" className="w-full" onClick={() => setOpen(false)}>
            Done
          </Button>
        }
      >
        <ul className="space-y-1">
          {Object.values(PLAYERS).map((p) => (
            <li key={p.displayName}>
              <button
                type="button"
                onClick={() => setOpen(false)}
                className="flex min-h-11 w-full items-center rounded-lg px-2 hover:bg-surface-2"
              >
                <PlayerChip player={p} />
              </button>
            </li>
          ))}
        </ul>
      </BottomSheet>
    </>
  );
}

export function SegmentedDemo() {
  const [value, setValue] = useState<"ours" | "theirs" | "both">("ours");
  return (
    <Segmented
      value={value}
      onChange={setValue}
      options={[
        { value: "ours", label: "Patriots" },
        { value: "theirs", label: "Bills" },
        { value: "both", label: "Both" },
      ]}
    />
  );
}

export function TeamPickerDemo() {
  const [abbr, setAbbr] = useState<string | null>("NE");
  return <TeamPicker teams={NFL_TEAMS} value={abbr} onChange={setAbbr} />;
}

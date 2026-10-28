import { ArrowLeftRight, HeartPulse, ListPlus, PenLine } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { Editing } from "@/app/moves/forms/moveForm";

/** The buttons that open the move sheets, or the injury sheet on the injury report. */
export function MoveActions({ injuries, onOpen }: { injuries: boolean; onOpen: (editing: Editing) => void }) {
  if (injuries) {
    return (
      <div className="flex flex-wrap gap-2">
        <Button variant="primary" size="sm" onClick={() => onOpen({ kind: "injury" })}>
          <HeartPulse /> Log injury
        </Button>
      </div>
    );
  }
  return (
    <div className="flex flex-wrap gap-2">
      <Button variant="primary" size="sm" onClick={() => onOpen({ kind: "trade" })}>
        <ArrowLeftRight /> Record trade
      </Button>
      <Button size="sm" onClick={() => onOpen({ kind: "sign" })}>
        <PenLine /> Sign free agent
      </Button>
      <Button size="sm" onClick={() => onOpen({ kind: "other" })}>
        <ListPlus /> Other move
      </Button>
    </div>
  );
}

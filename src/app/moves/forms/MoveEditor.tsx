import { InjurySheet } from "./InjurySheet";
import { MoveSheet } from "./MoveSheet";
import { TradeSheet } from "./TradeSheet";
import type { Editing } from "./moveForm";
import type { SheetContext } from "./types";

/**
 * Whichever move or injury sheet is open. `session` changes on every open so each sheet starts
 * from its defaults (or the item being edited), while `open` going false lets it animate out.
 */
export function MoveEditor({
  editing,
  session,
  open,
  onOpenChange,
  context,
}: {
  editing: Editing | null;
  session: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
  context: SheetContext;
}) {
  if (!editing) return null;
  const props = { context, open, onOpenChange, prefill: editing.prefill };
  if (editing.kind === "injury") return <InjurySheet key={session} {...props} injury={editing.injury} />;
  if (editing.kind === "trade") return <TradeSheet key={session} {...props} move={editing.move} />;
  return <MoveSheet key={session} {...props} kind={editing.kind} move={editing.move} />;
}

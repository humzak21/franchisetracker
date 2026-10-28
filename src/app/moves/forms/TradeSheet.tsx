import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import type { Move } from "../types";
import { NotesField } from "./NotesField";
import { SheetActions } from "./SheetActions";
import { TimingFields } from "./TimingFields";
import { TradeSideFields } from "./TradeSideFields";
import {
  defaultPhase,
  newTradeSides,
  personKey,
  timingOf,
  tradeArgs,
  tradeSides,
  type Prefill,
  type Timing,
  type TradeSide,
} from "./moveForm";
import type { SheetContext } from "./types";
import { useSubmit } from "./useSubmit";

/**
 * The trade builder (FEATURES.md 5.10): two teams, the players and picks each sends, when it
 * happened and a note. Saving also moves the players' roster entries and the picks.
 */
export function TradeSheet({
  context,
  move,
  prefill,
  open,
  onOpenChange,
}: {
  context: SheetContext;
  /** The trade to edit; a new one otherwise. */
  move?: Move;
  prefill?: Prefill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.transactions.moves.save);
  const remove = useMutation(api.transactions.moves.remove);
  const current = context.seasons.find((s) => s._id === context.seasonId);
  const [timing, setTiming] = useState<Timing>(() =>
    move
      ? timingOf(move, context.seasonId)
      : { seasonId: context.seasonId, ...defaultPhase(current?.status ?? "upcoming") },
  );
  const [initialA, initialB] = move ? tradeSides(move) : newTradeSides(context.userTeamId, prefill);
  const [a, setA] = useState<TradeSide>(initialA);
  const [b, setB] = useState<TradeSide>(initialB);
  const [notes, setNotes] = useState(move?.notes ?? "");
  const { error, saving, run, setError } = useSubmit(() => onOpenChange(false));
  const taken = new Set([...a.players, ...b.players].map(personKey));
  const year = context.seasons.find((s) => s._id === timing.seasonId)?.year ?? current?.year ?? 0;
  const shared = { teams: context.teams, seasonId: timing.seasonId, year, taken };

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!a.teamId || !b.teamId) return setError("Pick both teams");
    const teamId = a.teamId;
    void run(() =>
      save({
        transactionId: move?._id,
        seasonId: timing.seasonId,
        type: "trade",
        phase: timing.phase,
        weekKey: timing.weekKey,
        ...tradeArgs(a, b, teamId),
        notes,
      }),
    );
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={move ? "Edit trade" : "Record a trade"}
      description="Rosters and picks update when you save."
    >
      <form onSubmit={submit} className="@container space-y-4">
        <TradeSideFields title="Team A" side={a} onChange={setA} {...shared} />
        <TradeSideFields title="Team B" side={b} onChange={setB} {...shared} />
        <TimingFields seasons={context.seasons} value={timing} onChange={setTiming} />
        <NotesField value={notes} onChange={setNotes} placeholder="Why it happened, who won it, conditions" />
        <SheetActions
          error={error}
          saving={saving}
          saveLabel={move ? "Save trade" : "Record trade"}
          onDelete={move ? () => void run(() => remove({ transactionId: move._id })) : undefined}
        />
      </form>
    </BottomSheet>
  );
}

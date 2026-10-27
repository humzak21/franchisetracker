import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TRANSACTION_LABELS, TRANSACTION_TYPES, type TransactionType } from "@shared/domain";
import { MOVE_DIRECTION } from "@shared/transactions";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Select } from "@/components/ui/select";
import type { Move } from "../types";
import { ContractFields } from "./ContractFields";
import { Field } from "./Field";
import { NotesField } from "./NotesField";
import { PeopleList } from "./PeopleList";
import { PersonPicker } from "./PersonPicker";
import { SheetActions } from "./SheetActions";
import { TeamSelect } from "./TeamSelect";
import { TimingFields } from "./TimingFields";
import {
  contractDraft,
  contractInput,
  defaultPhase,
  fromMovePerson,
  timingOf,
  toPersonInput,
  type Person,
  type Timing,
} from "./moveForm";
import type { SheetContext } from "./types";
import { useSubmit } from "./useSubmit";

const OTHER_TYPES = TRANSACTION_TYPES.filter((t) => t !== "trade" && t !== "sign");
/** Moves that come with contract terms. */
const WITH_CONTRACT: readonly TransactionType[] = [
  "sign",
  "resign",
  "extension",
  "restructure",
  "waiver_claim",
];

/**
 * A free agent signing (`kind` "sign") or any other one-player move: release, re-sign, waiver
 * claim, IR, activate, extension, restructure, retire. Saving also updates the roster.
 */
export function MoveSheet({
  context,
  kind,
  move,
  open,
  onOpenChange,
}: {
  context: SheetContext;
  kind: "sign" | "other";
  move?: Move;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.transactions.moves.save);
  const remove = useMutation(api.transactions.moves.remove);
  const current = context.seasons.find((s) => s._id === context.seasonId);
  const [type, setType] = useState<TransactionType>(move?.type ?? (kind === "sign" ? "sign" : "release"));
  const [teamId, setTeamId] = useState<Id<"teams">>(move?.team?._id ?? context.userTeamId);
  const [from, setFrom] = useState<Id<"teams"> | undefined>(move?.counterpart?._id);
  const stored = move?.playersIn[0] ?? move?.playersOut[0];
  const [person, setPerson] = useState<Person | null>(stored ? fromMovePerson(stored) : null);
  const [contract, setContract] = useState(contractDraft(move?.contract));
  const [timing, setTiming] = useState<Timing>(() =>
    move
      ? timingOf(move, context.seasonId)
      : { seasonId: context.seasonId, ...defaultPhase(current?.status ?? "upcoming") },
  );
  const [notes, setNotes] = useState(move?.notes ?? "");
  const { error, saving, run, setError } = useSubmit(() => onOpenChange(false));
  const hasContract = WITH_CONTRACT.includes(type);

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!person) return setError("Pick the player");
    const players = [toPersonInput(person)];
    const incoming = MOVE_DIRECTION[type] === "in";
    void run(() =>
      save({
        transactionId: move?._id,
        seasonId: timing.seasonId,
        type,
        phase: timing.phase,
        weekKey: timing.weekKey,
        teamId,
        counterpartTeamId: type === "waiver_claim" ? from : undefined,
        playersIn: incoming ? players : [],
        playersOut: incoming ? [] : players,
        picksIn: [],
        picksOut: [],
        contract: hasContract ? contractInput(contract) : undefined,
        notes,
      }),
    );
  };

  const title = kind === "sign" ? "free agent signing" : "move";
  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={move ? `Edit ${title}` : kind === "sign" ? "Sign a free agent" : "Record a move"}
      description="The roster updates when you save."
    >
      <form onSubmit={submit} className="@container space-y-4">
        <div className="grid grid-cols-2 gap-2">
          {kind === "other" && (
            <Field label="Move">
              <Select
                value={type}
                options={OTHER_TYPES.map((t) => ({ value: t, label: TRANSACTION_LABELS[t] }))}
                onValueChange={(t) => setType(t as TransactionType)}
              />
            </Field>
          )}
          <Field label="Team" className={kind === "sign" ? "col-span-2" : undefined}>
            <TeamSelect teams={context.teams} value={teamId} onChange={setTeamId} />
          </Field>
          {type === "waiver_claim" && (
            <Field label="Claimed from" className="col-span-2">
              <TeamSelect
                teams={context.teams.filter((t) => t._id !== teamId)}
                value={from}
                placeholder="Team that waived him (optional)"
                onChange={setFrom}
              />
            </Field>
          )}
        </div>
        <div className="space-y-2">
          <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            Player
          </div>
          {person ? (
            <PeopleList people={[person]} onRemove={() => setPerson(null)} />
          ) : (
            <PersonPicker
              key={teamId}
              label="Player"
              seasonId={timing.seasonId}
              teamId={teamId}
              exclude={new Set<string>()}
              modes={kind === "sign" ? ["search", "new"] : ["roster", "search", "new"]}
              onPick={setPerson}
            />
          )}
        </div>
        {hasContract && <ContractFields value={contract} onChange={setContract} />}
        <TimingFields seasons={context.seasons} value={timing} onChange={setTiming} />
        <NotesField value={notes} onChange={setNotes} />
        <SheetActions
          error={error}
          saving={saving}
          saveLabel={move ? "Save" : kind === "sign" ? "Record signing" : "Record move"}
          onDelete={move ? () => void run(() => remove({ transactionId: move._id })) : undefined}
        />
      </form>
    </BottomSheet>
  );
}

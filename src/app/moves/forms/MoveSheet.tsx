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
import { Field } from "@/components/forms/Field";
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
  type Prefill,
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
 * claim, IR, activate, extension, restructure, retire. Saving also updates the roster. Started
 * from several players (a batch picked on the roster or the players list), it records the same
 * move for each, one transaction per player.
 */
export function MoveSheet({
  context,
  kind,
  move,
  prefill,
  open,
  onOpenChange,
}: {
  context: SheetContext;
  kind: "sign" | "other";
  move?: Move;
  prefill?: Prefill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.transactions.moves.save);
  const remove = useMutation(api.transactions.moves.remove);
  const current = context.seasons.find((s) => s._id === context.seasonId);
  const [type, setType] = useState<TransactionType>(move?.type ?? (kind === "sign" ? "sign" : "release"));
  // A signing brings him to the user team; any other move acts on the team he plays for.
  const [teamId, setTeamId] = useState<Id<"teams">>(
    move?.team?._id ?? (kind === "other" ? prefill?.players[0]?.teamId : undefined) ?? context.userTeamId,
  );
  const [from, setFrom] = useState<Id<"teams"> | undefined>(move?.counterpart?._id);
  const stored = move?.playersIn[0] ?? move?.playersOut[0];
  const [people, setPeople] = useState<Person[]>(
    stored ? [fromMovePerson(stored)] : (prefill?.players.map((p) => p.person) ?? []),
  );
  const [contract, setContract] = useState(contractDraft(move?.contract));
  const [timing, setTiming] = useState<Timing>(() =>
    move
      ? timingOf(move, context.seasonId)
      : { seasonId: context.seasonId, ...defaultPhase(current?.status ?? "upcoming") },
  );
  const [notes, setNotes] = useState(move?.notes ?? "");
  const { error, saving, run, setError } = useSubmit(() => onOpenChange(false));
  // Terms belong to one player; a batch records the move without them.
  const hasContract = WITH_CONTRACT.includes(type) && people.length <= 1;

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (people.length === 0) return setError("Pick the player");
    const incoming = MOVE_DIRECTION[type] === "in";
    void run(async () => {
      for (const person of people) {
        const players = [toPersonInput(person)];
        await save({
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
        });
        // A batch that stops partway leaves only the players still to record.
        setPeople((left) => left.filter((q) => q !== person));
      }
    });
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
            {people.length > 1 ? `${people.length} players` : "Player"}
          </div>
          {people.length > 0 ? (
            <PeopleList people={people} onRemove={(p) => setPeople(people.filter((q) => q !== p))} />
          ) : (
            <PersonPicker
              key={teamId}
              label="Player"
              seasonId={timing.seasonId}
              teamId={teamId}
              exclude={new Set<string>()}
              modes={kind === "sign" ? ["search", "new"] : ["roster", "search", "new"]}
              onPick={(p) => setPeople([p])}
            />
          )}
        </div>
        {hasContract && <ContractFields value={contract} onChange={setContract} />}
        <TimingFields seasons={context.seasons} value={timing} onChange={setTiming} />
        <NotesField value={notes} onChange={setNotes} />
        <SheetActions
          error={error}
          saving={saving}
          saveLabel={
            move
              ? "Save"
              : people.length > 1
                ? `Record ${people.length} ${kind === "sign" ? "signings" : "moves"}`
                : kind === "sign"
                  ? "Record signing"
                  : "Record move"
          }
          onDelete={move ? () => void run(() => remove({ transactionId: move._id })) : undefined}
        />
      </form>
    </BottomSheet>
  );
}

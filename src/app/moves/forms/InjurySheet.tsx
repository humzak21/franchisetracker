import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { WEEK_KEYS, weekLabel, type WeekKey } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import type { Injury } from "../types";
import { Field } from "@/components/forms/Field";
import { NotesField } from "./NotesField";
import { PeopleList } from "./PeopleList";
import { PersonPicker } from "./PersonPicker";
import { SheetActions } from "./SheetActions";
import { TeamSelect } from "./TeamSelect";
import { parseWhole, toPersonInput, type Person, type Prefill } from "./moveForm";
import type { SheetContext } from "./types";
import { useSubmit } from "./useSubmit";

const NONE = "none";
const WEEK_OPTIONS = [
  { value: NONE, label: "No week" },
  ...WEEK_KEYS.map((w) => ({ value: w, label: weekLabel(w, "long") })),
];
const toWeek = (value: string) => (value === NONE ? undefined : (value as WeekKey));

/** Logs an injury by hand, or edits or removes one (`injury` given). */
export function InjurySheet({
  context,
  injury,
  prefill,
  open,
  onOpenChange,
}: {
  context: SheetContext;
  injury?: Injury;
  prefill?: Prefill;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.transactions.injuries.save);
  const remove = useMutation(api.transactions.injuries.remove);
  const p = injury?.player;
  const [person, setPerson] = useState<Person | null>(
    p?.playerId
      ? { kind: "existing", playerId: p.playerId, name: p.name, position: p.position }
      : (prefill?.players[0]?.person ?? null),
  );
  const [teamId, setTeamId] = useState<Id<"teams">>(
    injury?.team?._id ?? prefill?.players[0]?.teamId ?? context.userTeamId,
  );
  const [weekKey, setWeekKey] = useState<WeekKey | undefined>(injury?.weekKey);
  const [injuryType, setInjuryType] = useState(injury?.injuryType ?? "");
  const [lengthLabel, setLengthLabel] = useState(injury?.lengthLabel ?? "");
  const [weeks, setWeeks] = useState(injury?.lengthWeeks === undefined ? "" : String(injury.lengthWeeks));
  const [onIr, setOnIr] = useState(injury?.onIr ?? false);
  const [returnWeekKey, setReturnWeekKey] = useState<WeekKey | undefined>(injury?.returnWeekKey);
  const [notes, setNotes] = useState(injury?.notes ?? "");
  const { error, saving, run, setError } = useSubmit(() => onOpenChange(false));

  const submit = (event: FormEvent) => {
    event.preventDefault();
    if (!person) return setError("Pick the player");
    void run(() =>
      save({
        injuryId: injury?._id,
        seasonId: context.seasonId,
        player: toPersonInput(person),
        teamId,
        weekKey,
        injuryType,
        lengthWeeks: parseWhole(weeks),
        lengthLabel,
        onIr,
        returnWeekKey,
        notes,
      }),
    );
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={injury ? "Edit injury" : "Log an injury"}
      description="Goes on the injury report and the player's roster row."
    >
      <form onSubmit={submit} className="@container space-y-4">
        <Field label="Team">
          <TeamSelect teams={context.teams} value={teamId} onChange={setTeamId} />
        </Field>
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
              seasonId={context.seasonId}
              teamId={teamId}
              exclude={new Set<string>()}
              onPick={setPerson}
            />
          )}
        </div>
        <div className="grid grid-cols-2 gap-2">
          <Field label="Injury" className="col-span-2">
            <Input
              value={injuryType}
              maxLength={80}
              placeholder="High ankle sprain"
              onChange={(e) => setInjuryType(e.target.value)}
            />
          </Field>
          <Field label="Length">
            <Input
              value={lengthLabel}
              maxLength={80}
              placeholder="2-4 weeks"
              onChange={(e) => setLengthLabel(e.target.value)}
            />
          </Field>
          <Field label="Weeks out">
            <Input
              inputMode="numeric"
              value={weeks}
              placeholder="3"
              onChange={(e) => setWeeks(e.target.value.replace(/\D/g, "").slice(0, 2))}
            />
          </Field>
          <Field label="Week">
            <Select
              value={weekKey ?? NONE}
              options={WEEK_OPTIONS}
              onValueChange={(w) => setWeekKey(toWeek(w))}
            />
          </Field>
          <Field label="Back">
            <Select
              value={returnWeekKey ?? NONE}
              options={WEEK_OPTIONS}
              onValueChange={(w) => setReturnWeekKey(toWeek(w))}
            />
          </Field>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={onIr}
            onChange={(e) => setOnIr(e.target.checked)}
            className="size-5 accent-[var(--color-primary)]"
          />
          On injured reserve
        </label>
        <NotesField value={notes} onChange={setNotes} />
        <SheetActions
          error={error}
          saving={saving}
          saveLabel={injury ? "Save injury" : "Log injury"}
          onDelete={injury ? () => void run(() => remove({ injuryId: injury._id })) : undefined}
        />
      </form>
    </BottomSheet>
  );
}

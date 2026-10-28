import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  RECORD_BOOK_LABELS,
  RECORD_SCOPE_LABELS,
  RECORD_STATS,
  STAT_CATEGORY_LABELS,
  STAT_REGISTRY,
  type BoardBook,
  type RecordScope,
} from "@shared/stats";
import { Field } from "@/components/forms/Field";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import type { Split } from "./split";

/** A typed entry being edited: what the list shows of it. */
export type TypedDraft = {
  typedId: Id<"typedRecords">;
  statKey: string;
  name: string;
  playerId?: Id<"players">;
  teamAbbr?: string;
  year?: number;
  value: number;
};

const STAT_OPTIONS = RECORD_STATS.map((key) => ({
  value: key,
  label: STAT_REGISTRY[key].label,
  group: STAT_CATEGORY_LABELS[STAT_REGISTRY[key].category],
}));

/**
 * Types a record number into the team or all-time book (Bruce Smith, 200 career sacks): just the
 * number, with who, for whom and when. It replaces the computed entry for the same player.
 */
export function TypedRecordSheet({
  book,
  split,
  scope,
  statKey,
  draft,
  open,
  onOpenChange,
}: {
  book: BoardBook;
  split: Split;
  scope: RecordScope;
  statKey: string;
  draft?: TypedDraft;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.stats.typedRecords.save);
  const remove = useMutation(api.stats.typedRecords.remove);
  const teams = useQuery(api.league.teams.list, open ? {} : "skip");
  const [stat, setStat] = useState(draft?.statKey ?? statKey);
  const [name, setName] = useState(draft?.name ?? "");
  const [team, setTeam] = useState(draft?.teamAbbr ?? "");
  const [year, setYear] = useState(draft?.year ? String(draft.year) : "");
  const [value, setValue] = useState(draft ? String(draft.value) : "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await save({
        typedId: draft?.typedId,
        book,
        split,
        scope,
        statKey: stat,
        name,
        playerId: draft?.playerId,
        teamId: teams?.find((t) => t.abbr === team)?._id,
        year: year ? Number(year) : undefined,
        value: Number(value),
      });
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Could not save the record"));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={draft ? "Edit record" : "Add a record"}
      description={`${RECORD_BOOK_LABELS[book]} · ${RECORD_SCOPE_LABELS[scope]}${split === "postseason" ? " · Playoffs" : ""}`}
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <Field label="Stat">
          <Select value={stat} onValueChange={setStat} options={STAT_OPTIONS} />
        </Field>
        <Field label="Player">
          <Input
            value={name}
            maxLength={80}
            placeholder="Bruce Smith"
            onChange={(e) => setName(e.target.value)}
          />
        </Field>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Team">
            <Select
              value={team}
              onValueChange={setTeam}
              placeholder="Team (optional)"
              options={(teams ?? []).map((t) => ({ value: t.abbr, label: `${t.city} ${t.name}` }))}
            />
          </Field>
          <Field label={scope === "career" ? "Last season" : "Season"}>
            <Input
              inputMode="numeric"
              value={year}
              placeholder="2003"
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            />
          </Field>
        </div>
        <Field label="Number">
          <Input
            inputMode="decimal"
            value={value}
            placeholder="200"
            onChange={(e) => setValue(e.target.value.replace(/[^\d.]/g, ""))}
          />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
        <div className="flex gap-2">
          {draft && (
            <Button
              type="button"
              variant="ghost"
              onClick={() => void remove({ typedId: draft.typedId }).then(() => onOpenChange(false))}
            >
              <Trash2 /> Remove
            </Button>
          )}
          <Button type="submit" variant="primary" className="ml-auto" disabled={!name.trim() || !value}>
            Save
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

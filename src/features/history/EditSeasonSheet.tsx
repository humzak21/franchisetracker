import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { isPlayoffResult, PLAYOFF_RESULT_LABELS, PLAYOFF_RESULTS } from "@shared/domain";
import { Field } from "@/components/forms/Field";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

const PLAYOFF_OPTIONS = [
  { value: "", label: "Not recorded" },
  ...PLAYOFF_RESULTS.map((r) => ({ value: r, label: PLAYOFF_RESULT_LABELS[r] })),
];

const digits = (text: string, max: number) => text.replace(/\D/g, "").slice(0, max);
const optional = (text: string) => (text === "" ? undefined : Number(text));
const shown = (n: number | undefined) => (n === undefined ? "" : String(n));

/**
 * Corrects one saved season from History. A real season before the franchise edits everything;
 * a franchise season's record comes from its games, so only its finish, coach and note edit here.
 */
export function EditSeasonSheet({
  season,
  real,
  onClose,
}: {
  season: Doc<"seasons">;
  real: boolean;
  onClose: () => void;
}) {
  const update = useMutation(api.history.seasons.update);
  const r = season.userRecord;
  const [w, setW] = useState(shown(r?.w));
  const [l, setL] = useState(shown(r?.l));
  const [t, setT] = useState(shown(r?.t ?? 0));
  const [division, setDivision] = useState(shown(r?.divisionRank));
  const [seed, setSeed] = useState(shown(r?.seed));
  const [result, setResult] = useState<string>(r?.playoffResult ?? "");
  const [coach, setCoach] = useState(season.coaching?.headCoach ?? "");
  const [notes, setNotes] = useState(season.notes ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await update({
        seasonId: season._id,
        w: Number(w || 0),
        l: Number(l || 0),
        t: Number(t || 0),
        divisionRank: optional(division),
        seed: optional(seed),
        playoffResult: isPlayoffResult(result) ? result : undefined,
        headCoach: coach,
        notes,
      });
      onClose();
    } catch (e) {
      setError(errorMessage(e, "Could not save the season"));
    }
  };

  const count = (label: string, value: string, set: (v: string) => void) => (
    <Field label={label}>
      <Input
        inputMode="numeric"
        value={value}
        disabled={!real}
        onChange={(e) => set(digits(e.target.value, 2))}
      />
    </Field>
  );

  return (
    <BottomSheet
      open
      onOpenChange={(open) => !open && onClose()}
      title={`Edit ${season.year}`}
      description={
        real
          ? "A real season before the franchise: every part of it edits here."
          : "The record comes from this season's games; its finish, coach and note edit here."
      }
    >
      <form onSubmit={(e) => void submit(e)} className="space-y-4">
        <div className="grid grid-cols-3 gap-3">
          {count("Wins", w, setW)}
          {count("Losses", l, setL)}
          {count("Ties", t, setT)}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Field label="Division finish">
            <Input
              inputMode="numeric"
              placeholder="1"
              value={division}
              onChange={(e) => setDivision(digits(e.target.value, 1))}
            />
          </Field>
          <Field label="Playoff seed">
            <Input
              inputMode="numeric"
              placeholder="—"
              value={seed}
              onChange={(e) => setSeed(digits(e.target.value, 1))}
            />
          </Field>
        </div>
        <Field label="Playoffs">
          <Select value={result} onValueChange={setResult} options={PLAYOFF_OPTIONS} />
        </Field>
        <Field label="Head coach">
          <Input value={coach} maxLength={80} onChange={(e) => setCoach(e.target.value)} />
        </Field>
        <Field label="Note">
          <Input value={notes} maxLength={500} onChange={(e) => setNotes(e.target.value)} />
        </Field>
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
        <div className="flex justify-end gap-2">
          <Button type="button" variant="ghost" onClick={onClose}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

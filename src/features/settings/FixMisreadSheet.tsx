import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { useSeason } from "@/app/season";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

type Result = FunctionReturnType<typeof api.ops.maintenance.fixMisread>;

const MODE_TEXT = {
  merge: "The misread made this player, so they will be merged into the real one.",
  move: "This is a real player matched by mistake, so only the season's line moves.",
  place: "The name was right, so the season's line moves to that team.",
} as const;

const labelClass = "space-y-1 text-sm font-medium";

/** A name a season stats screen misread: checks what it would do, then does it. */
export function FixMisreadSheet({
  open,
  onOpenChange,
}: {
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const { seasons, season } = useSeason();
  const fix = useMutation(api.ops.maintenance.fixMisread);
  const [year, setYear] = useState<number | null>(null);
  const [name, setName] = useState("");
  const [into, setInto] = useState("");
  const [team, setTeam] = useState("");
  const [result, setResult] = useState<Result | null>(null);
  const [error, setError] = useState<string | null>(null);
  const chosenYear = year ?? season?.year ?? 0;
  const args = {
    year: chosenYear,
    name: name.trim(),
    teamAbbr: team.trim(),
    ...(into.trim() ? { into: into.trim() } : {}),
  };

  const send = async (dryRun: boolean) => {
    setError(null);
    try {
      setResult(await fix({ ...args, dryRun }));
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    void send(result === null || result.problem !== null);
  };
  const changed =
    <T,>(set: (value: T) => void) =>
    (value: T) => {
      set(value);
      setResult(null);
    };
  const ready = result !== null && result.problem === null && !result.done;

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="Fix a misread name" textEntry>
      <form className="space-y-3" onSubmit={submit}>
        <label className={labelClass}>
          <span>Season</span>
          <Select
            aria-label="Season"
            value={String(chosenYear)}
            options={[...seasons].reverse().map((s) => ({ value: String(s.year), label: String(s.year) }))}
            onValueChange={(value) => changed(setYear)(Number(value))}
          />
        </label>
        <label className={`${labelClass} block`}>
          <span>Name as filed</span>
          <Input required value={name} onChange={(e) => changed(setName)(e.target.value)} />
        </label>
        <label className={`${labelClass} block`}>
          <span>Real player, if the name is wrong</span>
          <Input value={into} onChange={(e) => changed(setInto)(e.target.value)} />
        </label>
        <label className={`${labelClass} block`}>
          <span>Team abbreviation</span>
          <Input required maxLength={4} value={team} onChange={(e) => changed(setTeam)(e.target.value)} />
        </label>
        {result?.done ? (
          <p role="status" className="text-sm text-win">
            Fixed.
          </p>
        ) : result?.problem ? (
          <p role="alert" className="text-sm text-loss">
            {result.problem}. Sort that out on the player page, or merge them there.
          </p>
        ) : (
          result?.mode && <p className="text-sm text-muted-foreground">{MODE_TEXT[result.mode]}</p>
        )}
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
        <Button type="submit" variant="primary" disabled={result?.done === true}>
          {ready ? "Apply" : "Check"}
        </Button>
      </form>
    </BottomSheet>
  );
}

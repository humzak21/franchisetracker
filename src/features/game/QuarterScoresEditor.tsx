import { useMutation } from "convex/react";
import { Minus, Plus } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { lineScoreError, periodLabel, REGULATION_QUARTERS, type LineScore } from "@shared/games/lineScore";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import type { QuarterSide } from "./QuarterScores";

type Draft = { away: string[]; home: string[] };

const blank = () => Array<string>(REGULATION_QUARTERS).fill("");
const toNumbers = (cells: string[]) => cells.map((c) => (c.trim() === "" ? 0 : Number(c)));

/** Quarter score inputs for both teams; overtime periods add and remove as columns. */
export function QuarterScoresEditor({
  gameId,
  lineScore,
  away,
  home,
  onDone,
}: {
  gameId: Id<"games">;
  lineScore: LineScore | null;
  away: QuarterSide;
  home: QuarterSide;
  onDone: () => void;
}) {
  const save = useMutation(api.games.schedule.setLineScore);
  const [draft, setDraft] = useState<Draft>(() =>
    lineScore
      ? { away: lineScore.away.map(String), home: lineScore.home.map(String) }
      : { away: blank(), home: blank() },
  );
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const periods = draft.home.length;

  const resize = (n: number) =>
    setDraft((d) => ({
      away: [...d.away.slice(0, n), ...Array<string>(Math.max(0, n - d.away.length)).fill("")],
      home: [...d.home.slice(0, n), ...Array<string>(Math.max(0, n - d.home.length)).fill("")],
    }));
  const run = async (value: LineScore | null) => {
    setSaving(true);
    try {
      await save({ gameId, lineScore: value });
      onDone();
    } catch (err) {
      setError(errorMessage(err, "Could not save the quarter scores"));
    } finally {
      setSaving(false);
    }
  };
  const submit = (e: FormEvent) => {
    e.preventDefault();
    const value = { away: toNumbers(draft.away), home: toNumbers(draft.home) };
    const problem = lineScoreError(value, { away: away.score, home: home.score });
    if (problem) return setError(problem);
    void run(value);
  };

  return (
    <form onSubmit={submit} className="space-y-3 rounded-xl border border-border bg-surface p-3">
      <div className="overflow-x-auto" data-swipe-ignore>
        <table className="text-sm">
          <thead>
            <tr className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              <th scope="col" className="pr-2 text-left">
                <span className="sr-only">Team</span>
              </th>
              {draft.home.map((_, i) => (
                <th key={i} scope="col" className="px-0.5 pb-1 text-center">
                  {periodLabel(i)}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {(["away", "home"] as const).map((key) => {
              const side = key === "away" ? away : home;
              return (
                <tr key={key}>
                  <th scope="row" className="pr-2 text-left font-medium">
                    {side.team.abbr}
                  </th>
                  {draft[key].map((value, i) => (
                    <td key={i} className="px-0.5 py-0.5">
                      <input
                        aria-label={`${side.team.abbr} ${periodLabel(i)} points`}
                        inputMode="numeric"
                        value={value}
                        placeholder="0"
                        onChange={(e) =>
                          setDraft((d) => ({
                            ...d,
                            [key]: d[key].map((c, j) => (j === i ? e.target.value : c)),
                          }))
                        }
                        className="num h-9 w-11 rounded-md border border-input bg-surface text-center text-sm focus-visible:border-primary focus-visible:outline-none pointer-coarse:h-11 pointer-coarse:text-base"
                      />
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {error && (
        <p role="alert" className="text-sm text-loss">
          {error}
        </p>
      )}
      <div className="flex flex-wrap items-center gap-2">
        <Button size="sm" variant="ghost" onClick={() => resize(periods + 1)}>
          <Plus /> Overtime
        </Button>
        {periods > REGULATION_QUARTERS && (
          <Button size="sm" variant="ghost" onClick={() => resize(periods - 1)}>
            <Minus /> Remove {periodLabel(periods - 1)}
          </Button>
        )}
        <span className="flex-1" />
        {lineScore && (
          <Button size="sm" variant="ghost" disabled={saving} onClick={() => void run(null)}>
            Clear
          </Button>
        )}
        <Button size="sm" variant="outline" onClick={onDone}>
          Cancel
        </Button>
        <Button size="sm" variant="primary" type="submit" disabled={saving}>
          Save
        </Button>
      </div>
    </form>
  );
}

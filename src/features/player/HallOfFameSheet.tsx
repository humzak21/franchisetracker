import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { HofCasePanel } from "./HofCasePanel";
import { Textarea } from "@/components/ui/textarea";

type Plaque = FunctionReturnType<typeof api.hof.entries.forPlayer>;

const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);
const label = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

/**
 * Induction from the player page (FEATURES.md 5.7): class year, number and whether it is retired,
 * the seasons to remember, and a blurb. Saving again edits the plaque and refreshes its career.
 */
export function HallOfFameSheet({
  playerId,
  name,
  plaque,
  open,
  onOpenChange,
}: {
  playerId: Id<"players">;
  name: string;
  plaque: Plaque;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const induct = useMutation(api.hof.entries.inductPlayer);
  const remove = useMutation(api.hof.entries.remove);
  const { entry, defaults } = plaque;
  const [year, setYear] = useState(String(entry?.inductedYear ?? defaults.inductedYear));
  const [jersey, setJersey] = useState(String(entry?.jersey ?? defaults.jersey ?? ""));
  const [retired, setRetired] = useState(entry?.retiredNumber ?? false);
  const [highlights, setHighlights] = useState<number[]>(entry?.highlightSeasons ?? []);
  const [blurb, setBlurb] = useState(entry?.blurb ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await induct({
        playerId,
        inductedYear: Number(year),
        jersey: jersey === "" ? undefined : Number(jersey),
        retiredNumber: retired,
        highlightSeasons: highlights,
        blurb: blurb || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  const toggle = (y: number) => setHighlights((h) => (h.includes(y) ? h.filter((x) => x !== y) : [...h, y]));

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? "Hall of Fame plaque" : `Induct ${name}`}
      description="Their jersey hangs on the wall in team colors; the career with the team is summed on save."
    >
      <form onSubmit={submit} className="space-y-4">
        <HofCasePanel playerId={playerId} open={open} />
        <div className="grid grid-cols-2 gap-2">
          <label className="space-y-1">
            <span className={label}>Class of</span>
            <Input inputMode="numeric" value={year} onChange={(e) => setYear(digits(e.target.value, 4))} />
          </label>
          <label className="space-y-1">
            <span className={label}>Jersey</span>
            <Input
              inputMode="numeric"
              value={jersey}
              onChange={(e) => setJersey(digits(e.target.value, 2))}
            />
          </label>
        </div>
        <label className="flex min-h-11 items-center gap-3 text-sm">
          <input
            type="checkbox"
            checked={retired}
            disabled={jersey === ""}
            onChange={(e) => setRetired(e.target.checked)}
            className="size-5 accent-[var(--color-primary)]"
          />
          Retire number {jersey === "" ? "" : `#${jersey}`}
        </label>
        {defaults.years.length > 0 && (
          <fieldset className="space-y-1.5">
            <legend className={label}>Seasons to remember</legend>
            <div className="flex flex-wrap gap-1.5">
              {defaults.years.map((y) => (
                <button
                  key={y}
                  type="button"
                  aria-pressed={highlights.includes(y)}
                  onClick={() => toggle(y)}
                  className={cn(
                    "num h-8 rounded-full border px-3 text-[13px] font-medium pointer-coarse:h-11",
                    highlights.includes(y)
                      ? "border-primary bg-elite-1 text-primary"
                      : "border-border-strong text-muted-foreground",
                  )}
                >
                  {y}
                </button>
              ))}
            </div>
          </fieldset>
        )}
        <label className="block space-y-1">
          <span className={label}>Blurb</span>
          <Textarea
            value={blurb}
            rows={4}
            maxLength={2000}
            placeholder="Why they belong on the wall."
            onChange={(e) => setBlurb(e.target.value)}
          />
        </label>
        {error && <p className="text-sm text-loss">{error}</p>}
        <div className="flex gap-2">
          {entry && (
            <Button
              variant="ghost"
              onClick={() => void remove({ entryId: entry._id }).then(() => onOpenChange(false))}
            >
              <Trash2 /> Remove
            </Button>
          )}
          <Button type="submit" variant="primary" className="ml-auto" disabled={year.length !== 4}>
            {entry ? "Save plaque" : "Induct"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

import { useMutation } from "convex/react";
import { Pencil, Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { TROPHY_KINDS, TROPHY_LABELS, type TrophyKind } from "@shared/history/trophies";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";

const KIND_OPTIONS = TROPHY_KINDS.map((kind) => ({
  value: kind,
  label: TROPHY_LABELS[kind].title.split(" ")[0]!,
}));

/** Add or remove real-history titles (the team's history before the franchise began). */
export function EditHistory({
  entries,
  beforeYear,
}: {
  entries: Doc<"trophyEntries">[];
  beforeYear: number;
}) {
  const [open, setOpen] = useState(false);
  const [year, setYear] = useState("");
  const [kind, setKind] = useState<TrophyKind>("superBowl");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const add = useMutation(api.history.trophies.addEntry);
  const remove = useMutation(api.history.trophies.removeEntry);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await add({ year: Number(year), kind, note: note || undefined });
      setYear("");
      setNote("");
    } catch {
      setError("Enter a year between 1900 and 2100.");
    }
  };

  return (
    <>
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Pencil /> Real history
      </Button>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Real history"
        description={`Titles from before ${beforeYear} sit on the wall next to the franchise's own.`}
      >
        <form onSubmit={submit} className="space-y-3">
          <Segmented
            value={kind}
            onChange={setKind}
            options={KIND_OPTIONS}
            className="flex w-full"
            aria-label="Trophy"
          />
          <div className="flex gap-2">
            <Input
              inputMode="numeric"
              placeholder="Year"
              aria-label="Year"
              value={year}
              onChange={(e) => setYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
              className="w-24"
            />
            <Input
              placeholder="Note (optional)"
              aria-label="Note"
              value={note}
              onChange={(e) => setNote(e.target.value)}
            />
            <Button type="submit" variant="primary" disabled={year.length !== 4}>
              <Plus /> Add
            </Button>
          </div>
          {error && <p className="text-sm text-loss">{error}</p>}
        </form>
        <ul className="mt-5 divide-y divide-border">
          {entries.map((entry) => (
            <li key={entry._id} className="flex min-h-12 items-center gap-3 text-sm">
              <span className="num w-12 font-semibold">{entry.year}</span>
              <span className="flex-1">
                {TROPHY_LABELS[entry.kind].one}
                {entry.note && <span className="text-muted-foreground"> · {entry.note}</span>}
              </span>
              <Button
                variant="ghost"
                size="icon-sm"
                aria-label={`Remove ${entry.year}`}
                onClick={() => void remove({ entryId: entry._id })}
              >
                <Trash2 />
              </Button>
            </li>
          ))}
          {entries.length === 0 && (
            <li className="py-3 text-sm text-muted-foreground">No real-history titles yet.</li>
          )}
        </ul>
      </BottomSheet>
    </>
  );
}

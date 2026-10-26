import { useMutation } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { NFL_TEAMS } from "@shared/domain";
import { useFranchise } from "@/app/franchise";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

function AddPickSheet({
  years,
  rounds,
  open,
  onOpenChange,
}: {
  years: number[];
  rounds: number;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const userAbbr = useFranchise()?.userTeam.abbr ?? "";
  const add = useMutation(api.draft.inventory.add);
  const [direction, setDirection] = useState<"acquired" | "traded">("acquired");
  const [year, setYear] = useState(String(years[0] ?? ""));
  const [round, setRound] = useState("1");
  const [team, setTeam] = useState("");
  const [via, setVia] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await add({
        year: Number(year),
        round: Number(round),
        originAbbr: direction === "acquired" ? team : userAbbr,
        ownerAbbr: direction === "acquired" ? userAbbr : team,
        acquiredVia: via || undefined,
      });
      setVia("");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };
  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title="A pick changed hands">
      <form onSubmit={submit} className="space-y-3">
        <Segmented
          className="flex w-full"
          aria-label="Direction"
          value={direction}
          onChange={setDirection}
          options={[
            { value: "acquired", label: "We got one" },
            { value: "traded", label: "We traded ours" },
          ]}
        />
        <div className="grid grid-cols-2 gap-2">
          <Select
            aria-label="Year"
            value={year}
            onValueChange={setYear}
            options={years.map((y) => ({ value: String(y), label: String(y) }))}
          />
          <Select
            aria-label="Round"
            value={round}
            onValueChange={setRound}
            options={Array.from({ length: rounds }, (_, i) => ({
              value: String(i + 1),
              label: `Round ${i + 1}`,
            }))}
          />
        </div>
        <Select
          aria-label={direction === "acquired" ? "From" : "To"}
          value={team}
          placeholder={direction === "acquired" ? "Whose pick it was" : "Who has it now"}
          onValueChange={setTeam}
          options={NFL_TEAMS.filter((t) => t.abbr !== userAbbr).map((t) => ({
            value: t.abbr,
            label: `${t.city} ${t.name}`,
          }))}
        />
        <Input
          aria-label="How"
          placeholder="How (the trade, optional)"
          value={via}
          maxLength={120}
          onChange={(e) => setVia(e.target.value)}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={!team}>
          Save pick
        </Button>
      </form>
    </BottomSheet>
  );
}

/**
 * Pick inventory (FEATURES.md 5.9): the next drafts round by round. Our own picks unless traded,
 * plus the picks we acquired, each with how it changed hands.
 */
export function InventoryView() {
  const data = useQuery(api.draft.inventory.list, {});
  const remove = useMutation(api.draft.inventory.remove);
  const [adding, setAdding] = useState(false);
  if (data === undefined) return <Skeleton className="h-48 rounded-xl" />;
  return (
    <div className="@container space-y-5">
      <Button variant="outline" size="sm" onClick={() => setAdding(true)}>
        <Plus /> A pick changed hands
      </Button>
      <div className="grid gap-4 @desktop:grid-cols-3">
        {data.years.map((year) => (
          <section
            key={year}
            className="rounded-xl border border-border bg-surface"
            aria-label={`${year} draft`}
          >
            <h3 className="border-b border-border px-3 py-2 font-display text-lg font-semibold">
              {year} draft
            </h3>
            <ul>
              {Array.from({ length: data.rounds }, (_, i) => i + 1).map((round) => {
                const traded = data.traded.find((p) => p.year === year && p.round === round);
                const extra = data.acquired.filter((p) => p.year === year && p.round === round);
                return (
                  <li
                    key={round}
                    className="flex min-h-11 flex-wrap items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0"
                  >
                    <span className="num w-10 text-xs text-subtle-foreground">Rd {round}</span>
                    <span className={cn("text-sm", traded && "text-muted-foreground line-through")}>Own</span>
                    {traded && (
                      <Badge tone="loss" title={traded.acquiredVia}>
                        to {traded.owner.abbr}
                      </Badge>
                    )}
                    {extra.map((p) => (
                      <Badge key={p._id} tone="win" title={p.acquiredVia}>
                        + {p.origin.abbr}
                      </Badge>
                    ))}
                    {[traded, ...extra]
                      .filter((p) => p !== undefined)
                      .map((p) => (
                        <Button
                          key={p._id}
                          size="icon-sm"
                          variant="ghost"
                          className="ml-auto"
                          aria-label={`Remove ${year} round ${round} ${p.origin.abbr} pick`}
                          onClick={() => void remove({ id: p._id })}
                        >
                          <Trash2 />
                        </Button>
                      ))}
                  </li>
                );
              })}
            </ul>
          </section>
        ))}
      </div>
      <AddPickSheet years={data.years} rounds={data.rounds} open={adding} onOpenChange={setAdding} />
    </div>
  );
}

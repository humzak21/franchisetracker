import { useMutation, useQuery } from "convex/react";
import { Plus, Trash2 } from "lucide-react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { AwardCard } from "./AwardCard";
import type { SeasonAward } from "./types";

const SUGGESTED = [
  "Team MVP",
  "Offensive Player of the Year",
  "Defensive Player of the Year",
  "Rookie of the Year",
  "Most Improved",
];

function GiveSheet({
  seasonId,
  open,
  onOpenChange,
}: {
  seasonId: Id<"seasons">;
  open: boolean;
  onOpenChange: (o: boolean) => void;
}) {
  const roster = useQuery(api.players.roster.bySeason, open ? { seasonId } : "skip");
  const give = useMutation(api.awards.awards.giveTeamAward);
  const [name, setName] = useState(SUGGESTED[0]!);
  const [playerId, setPlayerId] = useState("");
  const [note, setNote] = useState("");
  const [error, setError] = useState<string | null>(null);
  const players = (roster?.entries ?? [])
    .map((e) => ({ value: e.player._id, label: `${e.player.displayName} · ${e.entry.position}` }))
    .sort((a, b) => a.label.localeCompare(b.label));

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await give({ seasonId, name, playerId: playerId as Id<"players">, note: note || undefined });
      setNote("");
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Give a team award"
      description="Your own awards, chosen from the roster."
    >
      <form onSubmit={submit} className="space-y-3">
        <label className="block space-y-1">
          <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
            Award
          </span>
          <Input
            list="team-award-names"
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
          />
          <datalist id="team-award-names">
            {SUGGESTED.map((s) => (
              <option key={s} value={s} />
            ))}
          </datalist>
        </label>
        <Select
          aria-label="Player"
          value={playerId}
          placeholder="Choose a player"
          options={players}
          onValueChange={setPlayerId}
        />
        <Input
          aria-label="Note"
          placeholder="Why (optional)"
          value={note}
          maxLength={300}
          onChange={(e) => setNote(e.target.value)}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <Button type="submit" variant="primary" className="w-full" disabled={!playerId || !name.trim()}>
          Give award
        </Button>
      </form>
    </BottomSheet>
  );
}

/** Team awards the owner gives (FEATURES.md 5.8): team MVP, rookie of the year, anything else. */
export function TeamAwards({ seasonId, awards }: { seasonId: Id<"seasons">; awards: SeasonAward[] }) {
  const remove = useMutation(api.awards.awards.remove);
  const [open, setOpen] = useState(false);
  const own = awards.filter((a) => a.scope === "team");
  return (
    <div className="space-y-3">
      <Button variant="outline" size="sm" onClick={() => setOpen(true)}>
        <Plus /> Give a team award
      </Button>
      {own.length === 0 ? (
        <p className="text-sm text-muted-foreground">No team awards for this season yet.</p>
      ) : (
        <ul className="grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
          {own.map((a) => (
            <li key={a._id}>
              <AwardCard
                award={a}
                action={
                  <Button
                    size="icon-sm"
                    variant="ghost"
                    aria-label={`Remove ${a.customName ?? "award"}`}
                    onClick={() => void remove({ awardId: a._id })}
                  >
                    <Trash2 />
                  </Button>
                }
              />
            </li>
          ))}
        </ul>
      )}
      <GiveSheet seasonId={seasonId} open={open} onOpenChange={setOpen} />
    </div>
  );
}

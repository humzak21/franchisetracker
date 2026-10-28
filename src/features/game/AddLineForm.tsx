import { useMutation } from "convex/react";
import { LoaderCircle, Plus, UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { POSITIONS, type Position } from "@shared/domain";
import { RAW_STAT_CATEGORIES, STAT_CATEGORY_LABELS, STAT_REGISTRY, type StatCategory } from "@shared/stats";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import { parseLine, rawStatsIn } from "./lineDraft";

type Picked = { playerId: Id<"players"> | null; name: string };
type AddLineFormProps = {
  gameId: Id<"games">;
  teams: readonly { team: Doc<"teams">; isUser: boolean }[];
  category: StatCategory;
};

const label = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

/** Adds a player's line by hand: pick a player or type a new name, then one category's stats. */
export function AddLineForm({ gameId, teams, category: initialCategory }: AddLineFormProps) {
  const addLine = useMutation(api.games.statLines.addLine);
  const [teamId, setTeamId] = useState<Id<"teams"> | undefined>(teams[0]?.team._id);
  const [search, setSearch] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [position, setPosition] = useState<Position | "">("");
  const [category, setCategory] = useState(initialCategory);
  const [inputs, setInputs] = useState<Record<string, string>>({});
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState<{ error: boolean; text: string } | null>(null);
  const found = useQuery(api.players.search.byName, picked ? "skip" : { text: search });
  const keys = rawStatsIn(category);

  const submit = async () => {
    const parsed = parseLine(Object.fromEntries(keys.map((k) => [k, inputs[k] ?? ""])));
    if (!teamId || !picked) return setMessage({ error: true, text: "Pick the team and the player" });
    if (!parsed.ok) return setMessage({ error: true, text: parsed.error });
    setBusy(true);
    setMessage(null);
    try {
      await addLine({
        gameId,
        teamId,
        stats: parsed.stats,
        ...(picked.playerId ? { playerId: picked.playerId } : { name: picked.name }),
        ...(position ? { position } : {}),
      });
      setMessage({ error: false, text: `Added ${picked.name}.` });
      setPicked(null);
      setSearch("");
      setInputs({});
      setPosition("");
    } catch (err) {
      setMessage({ error: true, text: errorMessage(err, "Could not add the line.") });
    } finally {
      setBusy(false);
    }
  };

  return (
    <div className="space-y-3">
      {teamId && (
        <Segmented
          aria-label="Team"
          value={teamId}
          onChange={setTeamId}
          options={teams.map((t) => ({ value: t.team._id, label: t.team.abbr }))}
        />
      )}
      {picked ? (
        <div className="flex items-center gap-2 rounded-lg bg-surface-2 px-3 py-2 text-sm">
          <span className="min-w-0 flex-1 truncate font-medium">
            {picked.name} {picked.playerId ? "" : "(new player)"}
          </span>
          <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
            Change
          </Button>
        </div>
      ) : (
        <div className="space-y-1.5">
          <Input
            aria-label="Player name"
            placeholder="Find a player or type a new name"
            value={search}
            maxLength={60}
            onChange={(e) => setSearch(e.target.value)}
          />
          <ul className="divide-y divide-border rounded-lg border border-border empty:hidden">
            {(found ?? []).map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => setPicked({ playerId: p._id, name: p.displayName })}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-surface-2"
                >
                  <span className="flex-1 truncate">{p.displayName}</span>
                  <span className="text-xs text-subtle-foreground">{p.position}</span>
                </button>
              </li>
            ))}
            {search.trim().length >= 2 && (
              <li>
                <button
                  type="button"
                  onClick={() => setPicked({ playerId: null, name: search.trim() })}
                  className="flex min-h-11 w-full items-center gap-2 px-3 text-left text-sm hover:bg-surface-2"
                >
                  <UserPlus className="size-4 text-muted-foreground" /> New player “{search.trim()}”
                </button>
              </li>
            )}
          </ul>
        </div>
      )}
      <div className="grid grid-cols-2 gap-3">
        <label className="space-y-1.5">
          <span className={label}>Stats</span>
          <Select
            aria-label="Stat category"
            value={category}
            onValueChange={(c) => setCategory(c as StatCategory)}
            options={RAW_STAT_CATEGORIES.map((c) => ({ value: c, label: STAT_CATEGORY_LABELS[c] }))}
          />
        </label>
        <label className="space-y-1.5">
          <span className={label}>Position</span>
          <Select
            aria-label="Position"
            value={position}
            placeholder="As listed"
            onValueChange={(p) => setPosition(p as Position)}
            options={POSITIONS.map((p) => ({ value: p, label: p }))}
          />
        </label>
      </div>
      <div className="grid grid-cols-[repeat(auto-fill,minmax(5rem,1fr))] gap-2">
        {keys.map((key) => (
          <label key={key} className="space-y-1" title={STAT_REGISTRY[key].label}>
            <span className={label}>{STAT_REGISTRY[key].abbr}</span>
            <Input
              aria-label={STAT_REGISTRY[key].label}
              inputMode="decimal"
              value={inputs[key] ?? ""}
              onChange={(e) => setInputs((current) => ({ ...current, [key]: e.target.value }))}
              className="num"
            />
          </label>
        ))}
      </div>
      {message && (
        <p
          role={message.error ? "alert" : "status"}
          className={message.error ? "text-sm text-loss" : "text-sm text-win"}
        >
          {message.text}
        </p>
      )}
      <Button variant="primary" disabled={busy} onClick={() => void submit()} className="w-full">
        {busy ? <LoaderCircle className="animate-spin" /> : <Plus />} Add player line
      </Button>
    </div>
  );
}

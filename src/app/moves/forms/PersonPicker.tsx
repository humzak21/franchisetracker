import { Search } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { NewPersonFields } from "./NewPersonFields";
import type { Person } from "./moveForm";

type Mode = "roster" | "search" | "new";

const MODE_LABELS: Record<Mode, string> = { roster: "Roster", search: "Search", new: "New player" };

/**
 * Chooses a player for a move: from the team's roster that season, a search of every player, or
 * a new player typed in. Native select for the roster, so phones open their own picker.
 */
export function PersonPicker({
  seasonId,
  teamId,
  exclude,
  onPick,
  modes = ["roster", "search", "new"],
  label = "Add player",
}: {
  seasonId: Id<"seasons">;
  teamId?: Id<"teams">;
  /** Players already chosen, left out of the lists. */
  exclude: ReadonlySet<string>;
  onPick: (person: Person) => void;
  modes?: readonly Mode[];
  label?: string;
}) {
  const [mode, setMode] = useState<Mode>(modes[0] ?? "search");
  const [text, setText] = useState("");
  const roster = useQuery(
    api.transactions.forms.teamRoster,
    mode === "roster" && teamId ? { seasonId, teamId } : "skip",
  );
  const results = useQuery(
    api.players.search.byName,
    mode === "search" && text.trim().length >= 2 ? { text } : "skip",
  );
  const available = (roster ?? []).filter((p) => !exclude.has(p.playerId));

  return (
    <div className="space-y-2 rounded-lg border border-dashed border-border p-2">
      <Segmented
        size="sm"
        aria-label={`${label}: source`}
        value={mode}
        onChange={setMode}
        options={modes.map((m) => ({ value: m, label: MODE_LABELS[m] }))}
      />
      {mode === "roster" &&
        (teamId ? (
          <Select
            aria-label={label}
            value=""
            placeholder={roster === undefined ? "Loading roster…" : `${label} from the roster`}
            options={available.map((p) => ({
              value: p.playerId,
              label: `${p.position} · ${p.name}${p.ovr === undefined ? "" : ` · ${p.ovr}`}`,
            }))}
            onValueChange={(playerId) => {
              const p = available.find((r) => r.playerId === playerId);
              if (p) onPick({ kind: "existing", playerId: p.playerId, name: p.name, position: p.position });
            }}
          />
        ) : (
          <p className="text-sm text-muted-foreground">Pick the team first.</p>
        ))}
      {mode === "search" && (
        <div className="space-y-1">
          <label className="relative block">
            <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
            <Input
              value={text}
              onChange={(e) => setText(e.target.value)}
              placeholder="Search every player"
              className="pl-9"
              aria-label={`${label}: search players`}
            />
          </label>
          <ul className="space-y-0.5">
            {(results ?? [])
              .filter((p) => !exclude.has(p._id))
              .map((p) => (
                <li key={p._id}>
                  <button
                    type="button"
                    onClick={() => {
                      onPick({
                        kind: "existing",
                        playerId: p._id,
                        name: p.displayName,
                        position: p.position,
                      });
                      setText("");
                    }}
                    className="flex min-h-11 w-full items-center gap-3 rounded-lg px-2 text-left text-sm hover:bg-surface-2"
                  >
                    <PositionBadge position={p.position} />
                    <span className="font-medium">{p.displayName}</span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      {mode === "new" && <NewPersonFields label={label} onAdd={onPick} />}
    </div>
  );
}

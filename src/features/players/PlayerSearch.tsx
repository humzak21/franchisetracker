import type { FunctionReturnType } from "convex/server";
import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { PlayerChip } from "@/components/player/PlayerChip";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/lib/convex/useQuery";

export type SearchHit = FunctionReturnType<typeof api.players.directory.search>[number];

const span = (h: SearchHit) =>
  h.firstYear === null
    ? "No stats"
    : h.firstYear === h.lastYear
      ? String(h.firstYear)
      : `${h.firstYear}–${h.lastYear}`;

/** Name search across every player in the franchise, real history included; each hit gets an action. */
export function PlayerSearch({
  placeholder,
  action,
}: {
  placeholder: string;
  action: (hit: SearchHit) => ReactNode;
}) {
  const [text, setText] = useState("");
  const hits = useQuery(api.players.directory.search, text.trim().length >= 2 ? { text } : "skip");
  return (
    <div className="space-y-2">
      <div className="relative">
        <Search
          aria-hidden
          className="pointer-events-none absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground"
        />
        <Input
          type="search"
          value={text}
          onChange={(e) => setText(e.target.value)}
          placeholder={placeholder}
          aria-label={placeholder}
          className="pl-9"
        />
      </div>
      {hits && hits.length > 0 && (
        <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
          {hits.slice(0, 8).map((h) => (
            <li key={h.playerId} className="flex min-h-12 items-center justify-between gap-2 px-3 py-1.5">
              <PlayerChip
                size="sm"
                player={{ displayName: h.displayName, position: h.position, headshotUrl: h.headshotUrl }}
                caption={`${h.position} · ${span(h)}${h.retired ? " · retired" : ""}`}
              />
              {action(h)}
            </li>
          ))}
        </ul>
      )}
      {hits && hits.length === 0 && (
        <p className="px-1 text-sm text-muted-foreground">No player called “{text.trim()}”.</p>
      )}
    </div>
  );
}

import { Search, UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { Position } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/lib/convex/useQuery";

export type AddedPlayer = { name: string; playerId: Id<"players"> | null; position: Position | null };

type AddPlayerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  title: string;
  onAdd: (player: AddedPlayer) => void;
};

/**
 * Who a row or line typed in by hand is about: a player found by name, or a new player with the
 * name as typed. The same box serves as search and as the new player's name.
 */
export function AddPlayerSheet({ open, onOpenChange, title, onAdd }: AddPlayerSheetProps) {
  const [text, setText] = useState("");
  const name = text.trim();
  const results = useQuery(api.players.search.byName, open && name.length >= 2 ? { text: name } : "skip");
  const add = (player: AddedPlayer) => {
    onAdd(player);
    setText("");
    onOpenChange(false);
  };

  return (
    <BottomSheet open={open} onOpenChange={onOpenChange} title={title} description="Find a player or add one">
      <div className="space-y-4">
        <label className="relative block">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Player name"
            className="pl-9"
            aria-label="Player name"
          />
        </label>
        {results && results.length > 0 && (
          <ul aria-label="Matching players" className="space-y-1">
            {results.map((p) => (
              <li key={p._id}>
                <button
                  type="button"
                  onClick={() => add({ name: p.displayName, playerId: p._id, position: p.position })}
                  className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-2"
                >
                  <span className="font-medium">{p.displayName}</span>
                  <PositionBadge position={p.position} />
                </button>
              </li>
            ))}
          </ul>
        )}
        <button
          type="button"
          disabled={name.length < 2}
          onClick={() => add({ name, playerId: null, position: null })}
          className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-2 disabled:opacity-50"
        >
          <UserPlus className="size-4 text-primary" />
          <span className="font-medium">
            {name.length >= 2 ? `Add ${name} as a new player` : "Type a name"}
          </span>
        </button>
      </div>
    </BottomSheet>
  );
}

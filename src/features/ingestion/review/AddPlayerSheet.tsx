import { Search, UserPlus } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { Position } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Input } from "@/components/ui/input";
import { PickerGroup } from "./PickerGroup";
import { PickerOption } from "./PickerOption";
import { usePlayerSearch } from "./playerSearch";

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
  const { players, searching } = usePlayerSearch(text, open);
  const add = (player: AddedPlayer) => {
    onAdd(player);
    setText("");
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      textEntry
      title={title}
      description="Find a player or add one"
    >
      <div className="space-y-4">
        <label className="sticky top-0 z-10 block bg-surface pb-1">
          <Search className="absolute top-[calc(50%-2px)] left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            autoFocus
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Player name"
            className="pl-9"
            aria-label="Player name"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        <ul aria-label="New player">
          <PickerOption
            icon={<UserPlus className="size-4 shrink-0 text-primary" />}
            label={name.length >= 2 ? `Add “${name}” as a new player` : "Type a name"}
            disabled={name.length < 2}
            onClick={() => add({ name, playerId: null, position: null })}
          />
        </ul>
        {name.length >= 2 && (
          <PickerGroup
            label="Matching players"
            searching={searching}
            empty="No players by that name"
            count={players.length}
          >
            {players.map((p) => (
              <PickerOption
                key={p._id}
                label={p.displayName}
                position={p.position}
                detail={p.college}
                onClick={() => add({ name: p.displayName, playerId: p._id, position: p.position })}
              />
            ))}
          </PickerGroup>
        )}
      </div>
    </BottomSheet>
  );
}

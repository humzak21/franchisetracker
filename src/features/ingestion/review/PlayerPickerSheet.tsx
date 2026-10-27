import { Check, Search, UserPlus } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { PlayerMatch } from "@shared/ingestion/types";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";

type PlayerPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  printedName: string;
  match: PlayerMatch<Id<"players">>;
  value: Id<"players"> | null;
  /** The chosen player and their name, or null for a new player. */
  onChange: (player: { _id: Id<"players">; name: string } | null) => void;
};

/** Who a printed name is: the rosters' best guesses, a search of every player, or a new player. */
export function PlayerPickerSheet({
  open,
  onOpenChange,
  printedName,
  match,
  value,
  onChange,
}: PlayerPickerSheetProps) {
  const [text, setText] = useState("");
  const results = useQuery(api.players.search.byName, open && text.trim().length >= 2 ? { text } : "skip");
  const choose = (player: { _id: Id<"players">; name: string } | null) => {
    onChange(player);
    onOpenChange(false);
  };

  const option = (key: string, selected: boolean, onClick: () => void, children: ReactNode) => (
    <li key={key}>
      <button
        type="button"
        onClick={onClick}
        className={cn(
          "flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-2",
          selected && "bg-elite-1",
        )}
      >
        {children}
        {selected && <Check className="ml-auto size-4 text-primary" />}
      </button>
    </li>
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={printedName}
      description="Which player is this? Your choice is remembered for this team and season."
    >
      <div className="space-y-4">
        {match.candidates.length > 0 && (
          <ul aria-label="Likely players" className="space-y-1">
            {match.candidates.map((c) =>
              option(
                c.playerId,
                value === c.playerId,
                () => choose({ _id: c.playerId, name: c.name }),
                <>
                  <span className="font-medium">{c.name}</span>
                  <span className="num text-xs text-muted-foreground">
                    {Math.round(c.score * 100)}% match
                  </span>
                </>,
              ),
            )}
          </ul>
        )}
        <label className="relative block">
          <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder="Search every player"
            className="pl-9"
            aria-label="Search players"
          />
        </label>
        {results && results.length > 0 && (
          <ul aria-label="Search results" className="space-y-1">
            {results.map((p) =>
              option(
                p._id,
                value === p._id,
                () => choose({ _id: p._id, name: p.displayName }),
                <>
                  <span className="font-medium">{p.displayName}</span>
                  <PositionBadge position={p.position} />
                </>,
              ),
            )}
          </ul>
        )}
        <ul>
          {option(
            "new",
            value === null,
            () => choose(null),
            <>
              <UserPlus className="size-4 text-primary" />
              <span className="font-medium">Add as a new player</span>
            </>,
          )}
        </ul>
      </div>
    </BottomSheet>
  );
}

import { useMutation } from "convex/react";
import { Search } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { AWARD_INFO } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Input } from "@/components/ui/input";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import type { CountedAward, SlotKey } from "./types";

type AssignAwardSheetProps = {
  seasonId: Id<"seasons">;
  /** The award (and conference) being assigned; null keeps the sheet closed. */
  slot: SlotKey | null;
  /** The leaders the stats counted, offered first with their stat lines. */
  contenders: CountedAward["contenders"];
  onClose: () => void;
};

/** Assigns a season award to any player: a leader from the count, or anyone found by name. */
export function AssignAwardSheet({ seasonId, slot, contenders, onClose }: AssignAwardSheetProps) {
  const assign = useMutation(api.awards.assign.assign);
  const [text, setText] = useState("");
  const [error, setError] = useState<string | null>(null);
  const open = slot !== null;
  const results = useQuery(api.players.search.byName, open && text.trim().length >= 2 ? { text } : "skip");

  const pick = async (playerId: Id<"players">, statLine?: string) => {
    if (!slot) return;
    setError(null);
    try {
      await assign({ seasonId, ...slot, playerId, statLine });
      setText("");
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  const option = (key: string, onClick: () => void, children: ReactNode) => (
    <li key={key}>
      <button
        type="button"
        onClick={onClick}
        className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-2"
      >
        {children}
      </button>
    </li>
  );
  const leaders = contenders.flatMap((c) => (c.player ? [{ ...c, player: c.player }] : []));

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title={
        slot
          ? ["Assign", slot.conference, AWARD_INFO[slot.type].label].filter(Boolean).join(" ")
          : "Assign award"
      }
      description="The winner you choose replaces the imported or counted one for this season."
    >
      <div className="space-y-4">
        {leaders.length > 0 && (
          <ul aria-label="League leaders" className="space-y-1">
            {leaders.map((c) =>
              option(
                c.player._id,
                () => void pick(c.player._id, c.statLine),
                <>
                  <span className="min-w-0 flex-1 truncate font-medium">{c.name}</span>
                  <span className="num shrink-0 text-xs text-muted-foreground">
                    {c.team ? `${c.team.abbr} · ` : ""}
                    {c.statLine}
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
                () => void pick(p._id),
                <>
                  <span className="font-medium">{p.displayName}</span>
                  <PositionBadge position={p.position} />
                </>,
              ),
            )}
          </ul>
        )}
        {error && <p className="text-sm text-loss">{error}</p>}
      </div>
    </BottomSheet>
  );
}

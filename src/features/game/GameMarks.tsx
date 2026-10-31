import { Link } from "@tanstack/react-router";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MARK_HORIZON_LABELS } from "@shared/stats";
import { FactChip } from "@/components/data/FactChip";
import { useQuery } from "@/lib/convex/useQuery";

/** The marks players reached in this game, above its box score; nothing when there are none. */
export function GameMarks({ gameId }: { gameId: Id<"games"> }) {
  const marks = useQuery(api.stats.marks.forGame, { gameId });
  if (!marks || marks.length === 0) return null;
  return (
    <ul aria-label="Marks reached in this game" className="mb-3 flex flex-wrap gap-2">
      {marks.map((m) => (
        <li key={m.key} className="max-w-full">
          <Link to="/players/$playerId" params={{ playerId: m.player.playerId }}>
            <FactChip
              active
              value={m.gamesToReach}
              label={`${m.player.name}: ${m.label}`}
              detail={`Games to get there · ${MARK_HORIZON_LABELS[m.horizon].toLowerCase()}`}
              className="hover:border-border-strong"
            />
          </Link>
        </li>
      ))}
    </ul>
  );
}

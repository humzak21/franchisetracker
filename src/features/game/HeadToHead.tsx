import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import { ResultBadge } from "@/components/team/ResultBadge";
import { cn } from "@/lib/cn";

type HeadToHeadData = NonNullable<FunctionReturnType<typeof api.games.schedule.get>>["headToHead"];

/** All-time record against this opponent inside the franchise, with every meeting linked. */
export function HeadToHead({
  data,
  opponent,
  currentGameId,
}: {
  data: HeadToHeadData;
  opponent: string;
  currentGameId: string;
}) {
  return (
    <div className="rounded-xl border border-border bg-surface">
      <div className="flex items-baseline justify-between border-b border-border px-4 py-3">
        <span className="text-sm text-muted-foreground">All-time vs {opponent}</span>
        <span className="num font-display text-2xl font-bold">{formatRecord(data.record)}</span>
      </div>
      <ul className="max-h-72 divide-y divide-border overflow-y-auto">
        {data.games.map((game) => (
          <li key={game._id}>
            <Link
              to="/games/$gameId"
              params={{ gameId: game._id }}
              className={cn(
                "flex min-h-11 items-center gap-3 px-4 py-2 text-sm hover:bg-surface-2",
                game._id === currentGameId && "bg-elite-1",
              )}
            >
              <span className="num w-12 font-semibold">{game.year}</span>
              <span className="w-14 text-muted-foreground">{weekLabel(game.weekKey)}</span>
              <ResultBadge result={game.result} us={game.us} them={game.them} className="ml-auto" />
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

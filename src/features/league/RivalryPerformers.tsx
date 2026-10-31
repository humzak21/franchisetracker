import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { formatStat, STAT_REGISTRY } from "@shared/stats";
import { RankedList } from "@/components/data/RankedList";

type Performers = FunctionReturnType<typeof api.league.rivals.get>["performers"];

/** Who has done the most against one opponent, a list per stat with the best single game under it. */
export function RivalryPerformers({ performers }: { performers: Performers }) {
  return (
    <div className="grid gap-3 @tablet:grid-cols-2 @desktop:grid-cols-3">
      {performers.map(({ stat, rows, best }) => {
        const label = STAT_REGISTRY[stat].label;
        return (
          <RankedList
            key={stat}
            title={label}
            label={`${label} against them`}
            items={rows.map((r, i) => ({
              key: r.player._id,
              rank: i + 1,
              name: r.player.displayName,
              playerId: r.player._id,
              detail: `${r.games} ${r.games === 1 ? "game" : "games"}`,
              value: formatStat(stat, r.value),
            }))}
            footer={
              <Link
                to="/games/$gameId"
                params={{ gameId: best.gameId }}
                className="block px-4 py-2 text-xs text-muted-foreground hover:underline"
              >
                Best game: {best.player.displayName}, {formatStat(stat, best.value)}
              </Link>
            }
          />
        );
      })}
    </div>
  );
}

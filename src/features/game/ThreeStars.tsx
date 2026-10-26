import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import type { TeamLike } from "@/components/team/TeamLogo";
import { EmptyState } from "@/components/data/EmptyState";
import { PlayerChip } from "@/components/player/PlayerChip";

type StarView = FunctionReturnType<typeof api.games.schedule.get>["stars"][number];

/** The game's three stars in order, each linking to the player page when resolved. */
export function ThreeStars({ stars, team }: { stars: StarView[]; team: TeamLike }) {
  if (stars.length === 0) {
    return (
      <EmptyState icon={Star} title="No stars picked" description="Three stars come with the box score." />
    );
  }
  return (
    <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
      {stars.map((star, i) => {
        const chip = (
          <PlayerChip
            player={{ displayName: star.name, position: star.position ?? "", team }}
            showPosition={star.position !== null}
            caption={star.caption}
          />
        );
        return (
          <li key={`${star.name}-${i}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
            <span className="num w-5 font-display text-2xl font-bold text-primary">{i + 1}</span>
            {star.playerId ? (
              <Link
                to="/players/$playerId"
                params={{ playerId: star.playerId }}
                className="min-w-0 hover:underline"
              >
                {chip}
              </Link>
            ) : (
              <span className="min-w-0">{chip}</span>
            )}
          </li>
        );
      })}
    </ol>
  );
}

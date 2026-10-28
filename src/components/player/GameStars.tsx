import { Link } from "@tanstack/react-router";
import { Star } from "lucide-react";
import { cn } from "@/lib/cn";
import { EmptyState } from "../data/EmptyState";
import type { TeamLike } from "../team/TeamLogo";
import { PlayerChip } from "./PlayerChip";

export type StarView = {
  playerId: string | null;
  name: string;
  position: string | null;
  headshotUrl: string | null;
  caption: string | null;
  /** The side the star played for, when known. */
  teamId: string | null;
};

type GameStarsProps = {
  stars: readonly StarView[];
  /** The user's team: colors for stars with no team, or on the user's side. */
  team: TeamLike;
  /** The opponent, so its stars wear its colors. */
  opponent?: (TeamLike & { _id: string }) | null;
  /** `list`: numbered rows with captions (game detail). `chips`: wrapping chips (schedule rows, cards). */
  layout?: "list" | "chips";
};

/**
 * The stars of a game in the order they were picked, as many as the owner chose. Each links
 * to the player's page when the star is a player in the app.
 */
export function GameStars({ stars, team, opponent, layout = "list" }: GameStarsProps) {
  if (stars.length === 0) {
    return (
      <EmptyState
        icon={Star}
        title="No stars picked"
        description="Pick the game's stars by hand, as many as you like."
      />
    );
  }
  const teamOf = (star: StarView) => (opponent && star.teamId === opponent._id ? opponent : team);
  const entry = (star: StarView, size: "sm" | "md") => {
    const chip = (
      <PlayerChip
        size={size}
        player={{
          displayName: star.name,
          position: star.position ?? "",
          headshotUrl: star.headshotUrl,
          team: teamOf(star),
        }}
        showPosition={star.position !== null}
        caption={size === "md" ? star.caption : undefined}
      />
    );
    return star.playerId ? (
      <Link
        to="/players/$playerId"
        params={{ playerId: star.playerId }}
        className="relative z-10 min-w-0 hover:underline pointer-coarse:touch-target"
      >
        {chip}
      </Link>
    ) : (
      <span className="min-w-0">{chip}</span>
    );
  };

  if (layout === "chips") {
    return (
      <ol aria-label="Stars of the game" className="flex flex-wrap items-center gap-x-4 gap-y-2">
        {stars.map((star, i) => (
          <li
            key={`${star.name}-${i}`}
            className="flex min-w-0 items-center gap-1.5"
            title={star.caption ?? undefined}
          >
            <span className="num text-xs font-semibold text-primary">{i + 1}</span>
            {entry(star, "sm")}
          </li>
        ))}
      </ol>
    );
  }
  return (
    <ol className="divide-y divide-border rounded-xl border border-border bg-surface">
      {stars.map((star, i) => (
        <li key={`${star.name}-${i}`} className="flex min-h-14 items-center gap-3 px-4 py-2">
          <span
            className={cn(
              "num w-6 shrink-0 font-display text-2xl font-bold text-primary",
              i > 8 && "text-xl",
            )}
          >
            {i + 1}
          </span>
          {entry(star, "md")}
        </li>
      ))}
    </ol>
  );
}

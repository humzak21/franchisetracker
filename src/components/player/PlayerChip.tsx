import type { ReactNode } from "react";
import { cn } from "@/lib/cn";
import type { TeamLike } from "../team/TeamLogo";
import { Headshot } from "./Headshot";
import { PositionBadge } from "./PositionBadge";

export type PlayerLike = {
  displayName: string;
  position: string;
  jersey?: number | null;
  headshotUrl?: string | null;
  team?: Pick<TeamLike, "primaryColor" | "secondaryColor" | "abbr">;
};

type PlayerChipProps = {
  player: PlayerLike;
  /** Secondary line, e.g. a stat line caption for three stars. */
  caption?: ReactNode;
  /** `sm` is the table size: smaller headshot, position and number on a second line so the name gets the width. */
  size?: "sm" | "md";
  showPosition?: boolean;
  className?: string;
};

/** The way a player appears anywhere outside their own page. Wrap in a Link to navigate. */
export function PlayerChip({
  player,
  caption,
  size = "md",
  showPosition = true,
  className,
}: PlayerChipProps) {
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2.5", className)}>
      <Headshot
        name={player.displayName}
        src={player.headshotUrl}
        team={player.team}
        size={size === "sm" ? "xs" : "sm"}
      />
      <span className="min-w-0">
        <span className="flex items-center gap-1.5">
          <span className={cn("truncate font-medium", size === "sm" ? "text-[13px]" : "text-sm")}>
            {player.displayName}
          </span>
          {size === "md" && showPosition && <PositionBadge position={player.position} className="shrink-0" />}
          {size === "md" && player.jersey != null && (
            <span className="num shrink-0 text-xs text-subtle-foreground">#{player.jersey}</span>
          )}
        </span>
        {caption ? (
          <span className="block truncate text-xs text-muted-foreground">{caption}</span>
        ) : (
          size === "sm" &&
          showPosition && (
            <span className="block truncate text-[11px] leading-tight text-subtle-foreground">
              {player.position}
              {player.jersey != null && ` · #${player.jersey}`}
            </span>
          )
        )}
      </span>
    </span>
  );
}

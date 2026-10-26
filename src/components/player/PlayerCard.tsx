import { useState, type ReactNode } from "react";
import { mix, readableOn } from "@/design/color";
import { cn } from "@/lib/cn";
import { TeamLogo } from "../team/TeamLogo";
import { initials } from "./Headshot";
import type { PlayerLike } from "./PlayerChip";

const NEUTRAL = { abbr: "", primaryColor: "#334155", secondaryColor: "#64748b" };

/**
 * A trading card in team colors: the ESPN headshot for real players, a generated monogram card
 * for fictional ones (or when the photo fails). Fills its parent's width at a 5:7 card ratio and
 * scales its type with that width, so the same card works as a hero, a grid tile or a column head.
 */
export function PlayerCard({
  player,
  caption,
  className,
}: {
  player: PlayerLike;
  /** A line under the name, e.g. "2024–2026 · 3 seasons". */
  caption?: ReactNode;
  className?: string;
}) {
  const team = player.team ?? NEUTRAL;
  const [failed, setFailed] = useState<string | null>(null);
  const photo = player.headshotUrl && failed !== player.headshotUrl ? player.headshotUrl : null;
  const ink = readableOn(team.primaryColor);

  return (
    <figure
      className={cn(
        "@container relative isolate aspect-[5/7] w-full overflow-hidden rounded-2xl border border-white/10 shadow-lg",
        className,
      )}
      style={{
        color: ink,
        background: `linear-gradient(160deg, ${team.primaryColor} 0%, ${mix(team.primaryColor, "#000000", 0.45)} 78%)`,
      }}
    >
      <div
        aria-hidden
        className="absolute -inset-x-1/4 top-[46%] -z-10 h-[18%] -rotate-12 opacity-80"
        style={{ background: team.secondaryColor }}
      />
      <div
        aria-hidden
        className="absolute inset-0 -z-10 [background-image:repeating-linear-gradient(135deg,currentColor_0_1px,transparent_1px_10px)] opacity-[0.06]"
      />
      <div className="absolute inset-x-[7%] top-[5%] flex items-start justify-between">
        <span className="num font-display text-[16cqw] leading-none font-bold opacity-90">
          {player.jersey ?? ""}
        </span>
        <span className="rounded-md bg-black/25 px-[3cqw] py-[1cqw] font-display text-[8cqw] leading-none font-semibold tracking-wide">
          {player.position}
        </span>
      </div>
      {photo ? (
        <img
          src={photo}
          alt={player.displayName}
          onError={() => setFailed(photo)}
          loading="lazy"
          className="absolute inset-x-0 bottom-[22%] mx-auto w-[118%] max-w-none -translate-x-[8%] object-contain object-bottom drop-shadow-[0_8px_16px_rgb(0_0_0/0.35)]"
        />
      ) : (
        <span
          role="img"
          aria-label={player.displayName}
          className="absolute inset-x-0 top-[24%] text-center font-display text-[40cqw] leading-none font-bold tracking-tight drop-shadow-[0_4px_10px_rgb(0_0_0/0.3)]"
        >
          {initials(player.displayName)}
        </span>
      )}
      <figcaption className="absolute inset-x-0 bottom-0 flex items-end gap-[3cqw] bg-gradient-to-t from-black/70 via-black/45 to-transparent px-[7%] pt-[10%] pb-[6%] text-white">
        <span className="min-w-0 flex-1">
          <span className="block truncate font-display text-[11cqw] leading-[0.95] font-bold tracking-wide uppercase">
            {player.displayName}
          </span>
          {caption && <span className="mt-[1.5cqw] block truncate text-[6cqw] opacity-80">{caption}</span>}
        </span>
        {player.team && <TeamLogo team={player.team} size="sm" className="shrink-0" />}
      </figcaption>
    </figure>
  );
}

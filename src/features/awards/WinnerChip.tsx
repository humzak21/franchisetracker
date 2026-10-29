import { Link } from "@tanstack/react-router";
import { AWARD_INFO } from "@shared/domain";
import { PlayerChip } from "@/components/player/PlayerChip";
import { TeamLogo } from "@/components/team/TeamLogo";
import type { AwardWinner } from "./types";

/** Who won: the player (linked to their page), a coach with their team, or a name as printed. */
export function WinnerChip({ award }: { award: AwardWinner }) {
  if (award.player) {
    return (
      <Link
        to="/players/$playerId"
        params={{ playerId: award.player._id }}
        className="min-w-0 hover:underline pointer-coarse:touch-target"
      >
        <PlayerChip
          player={{ ...award.player, team: award.team ?? undefined }}
          size="sm"
          caption={award.statLine}
        />
      </Link>
    );
  }
  const coach = AWARD_INFO[award.type].coach;
  return (
    <span className="inline-flex min-w-0 items-center gap-2.5">
      {coach && award.team && <TeamLogo team={award.team} size="sm" />}
      <span className="min-w-0">
        <span className="block truncate text-sm font-medium">{award.name}</span>
        {(award.statLine || coach) && (
          <span className="block truncate text-xs text-muted-foreground">
            {award.statLine ?? (award.team ? `${award.team.name} head coach` : "Head coach")}
          </span>
        )}
      </span>
    </span>
  );
}

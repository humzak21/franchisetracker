import { Link } from "@tanstack/react-router";
import { formatStat, STAT_REGISTRY } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { Section } from "@/components/layout/Section";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { Recap } from "./types";

function Stars({ recap }: { recap: Recap }) {
  const team = useFranchise()?.userTeam;
  return (
    <Section title="Stars">
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-3">
        {recap.leaders.map((leader) => (
          <li key={leader.stat} className="flex min-h-12 items-center gap-3">
            <Link to="/players/$playerId" params={{ playerId: leader.player._id }} className="min-w-0 flex-1">
              <PlayerChip
                player={{ ...leader.player, team }}
                size="sm"
                caption={STAT_REGISTRY[leader.stat].label}
              />
            </Link>
            <span className="num font-display text-xl font-bold">
              {formatStat(leader.stat, leader.value)}
            </span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

function Awards({ recap }: { recap: Recap }) {
  return (
    <Section title="Awards">
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-3">
        {recap.awards.map((award) => (
          <li key={award.key} className="flex min-h-12 items-center gap-3 py-1.5 text-sm">
            <span className="min-w-0 flex-1">
              <span className="block font-medium">{award.label}</span>
              {award.playerId ? (
                <Link
                  to="/players/$playerId"
                  params={{ playerId: award.playerId }}
                  className="block truncate text-muted-foreground hover:underline"
                >
                  {award.name}
                </Link>
              ) : (
                <span className="block truncate text-muted-foreground">{award.name}</span>
              )}
            </span>
            {award.count > 1 && <span className="num font-medium">{award.count}×</span>}
          </li>
        ))}
      </ul>
    </Section>
  );
}

/** Who carried the year: the team's leaders beside what its players won. */
export function RecapPeople({ recap }: { recap: Recap }) {
  if (recap.leaders.length === 0 && recap.awards.length === 0) return null;
  return (
    <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @tablet:grid-cols-2">
      {recap.leaders.length > 0 && <Stars recap={recap} />}
      {recap.awards.length > 0 && <Awards recap={recap} />}
    </div>
  );
}

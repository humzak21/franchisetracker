import { Link } from "@tanstack/react-router";
import { formatStat, getStat, type StatKey } from "@shared/stats";
import { PlayerChip } from "@/components/player/PlayerChip";
import { PaceBar } from "./PaceBar";

export type CountdownView = {
  statKey: string;
  mark: number;
  value: number;
  remaining: number;
  gamesAway: number;
  player: { playerId: string; name: string; position: string; headshotUrl: string | null };
};

/** Who is closing in on a career mark and how far off they are, nearest first. */
export function CountdownList({ items }: { items: readonly CountdownView[] }) {
  return (
    <ul className="space-y-4">
      {items.map((c) => {
        const stat = c.statKey as StatKey;
        const { label } = getStat(stat);
        return (
          <li key={`${c.player.playerId}-${c.statKey}`}>
            <PaceBar
              label={
                <Link
                  to="/players/$playerId"
                  params={{ playerId: c.player.playerId }}
                  className="hover:underline"
                >
                  <PlayerChip
                    size="sm"
                    player={{
                      displayName: c.player.name,
                      position: c.player.position,
                      headshotUrl: c.player.headshotUrl,
                    }}
                  />
                </Link>
              }
              accessibleLabel={`${c.player.name}, ${label}`}
              value={c.value}
              target={c.mark}
              reading={`${formatStat(stat, c.value)} of ${formatStat(stat, c.mark)}`}
              caption={`${label}: ${formatStat(stat, c.remaining)} to go, about ${c.gamesAway} game${c.gamesAway === 1 ? "" : "s"}`}
            />
          </li>
        );
      })}
    </ul>
  );
}

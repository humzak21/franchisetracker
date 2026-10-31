import { Link } from "@tanstack/react-router";
import { Gauge } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import {
  formatRecord,
  formatSigned,
  formatStat,
  paceLine,
  pythagoreanWins,
  STREAK_LABELS,
  type StatKey,
  type StreakKey,
} from "@shared/stats";
import { PULSE_STATS, trendRows } from "@shared/stats/teamTrends";
import { useSeason } from "@/app/season";
import { CountdownList } from "@/components/data/CountdownList";
import { EmptyState } from "@/components/data/EmptyState";
import { FactChip } from "@/components/data/FactChip";
import { RankTrend } from "@/components/data/RankTrend";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Section } from "@/components/layout/Section";
import { PlayerChip } from "@/components/player/PlayerChip";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import type { View } from "./view";

const SHOWN_COUNTDOWNS = 3;
const SHOWN_STREAKS = 6;
/** A team streak is news at two, a player's at three. */
const MIN_TEAM_STREAK = 2;

/** One tile that opens the view holding its detail. */
function OpenTile({
  view,
  onOpen,
  ...tile
}: Parameters<typeof Tile>[0] & { view: View; onOpen: (v: View) => void }) {
  return (
    <button
      type="button"
      onClick={() => onOpen(view)}
      className="min-w-0 rounded-xl text-left hover:bg-surface-2 focus-visible:ring-2 focus-visible:ring-ring"
    >
      <Tile {...tile} className="h-full bg-transparent" />
    </button>
  );
}

/**
 * The season at a glance (STATS-HUB.md 3): the record and what it is on pace for, who leads, what
 * is within reach, what is running and what was set. Each tile opens the view behind it.
 */
export function Overview({ onOpen }: { onOpen: (view: View) => void }) {
  const { season } = useSeason();
  const args = season ? { seasonId: season._id } : "skip";
  const data = useQuery(api.stats.hub.overview, args);
  const countdowns = useQuery(api.stats.hub.countdownsFor, args);
  const streaks = useQuery(api.stats.streaks.running, {});
  const trends = useQuery(api.league.teamStats.trends, {});
  if (!season || data === undefined) return <Skeleton className="h-72 rounded-xl" />;
  if (data === null || (data.played === 0 && data.leaders.length === 0)) {
    return (
      <EmptyState
        icon={Gauge}
        title={`Nothing in ${season.year} yet`}
        description="The overview fills in from the first committed game."
      />
    );
  }

  const { record, played, pointsFor, pointsAgainst, gamesPerSeason } = data;
  const games = played || record.w + record.l + record.t;
  const pace = paceLine(record, pointsFor, season.status, gamesPerSeason);
  const expected = played ? pythagoreanWins(pointsFor, pointsAgainst, played) : null;
  const ranks = trends
    ? trendRows(trends, PULSE_STATS).filter((r) => r.points.some((p) => p.year === season.year))
    : [];
  const running = [
    ...(streaks?.team ?? [])
      .filter((s) => s.current >= MIN_TEAM_STREAK)
      .map((s) => ({ ...s, who: "Team", id: `team-${s.key}` })),
    ...(streaks?.players ?? []).map((s) => ({ ...s, who: s.player.name, id: `${s.player._id}-${s.key}` })),
  ]
    .sort((a, b) => b.current - a.current)
    .slice(0, SHOWN_STREAKS);

  return (
    <div className="space-y-6">
      <TileStrip>
        <OpenTile
          view="team"
          onOpen={onOpen}
          label="Record"
          value={formatRecord(record)}
          detail={pace?.replace("On pace for ", "Pace: ") ?? "Regular season"}
          accent
        />
        <OpenTile
          view="team"
          onOpen={onOpen}
          label="Differential"
          value={played ? formatSigned(pointsFor - pointsAgainst) : "—"}
          detail={played ? `${pointsFor} for, ${pointsAgainst} against` : "No scores"}
        />
        <OpenTile
          view="trends"
          onOpen={onOpen}
          label="Expected wins"
          value={expected === null ? "—" : expected.toFixed(1)}
          detail={expected === null ? "No scores" : `${record.w} actual`}
        />
        <OpenTile
          view="team"
          onOpen={onOpen}
          label="Points a game"
          value={games && played ? (pointsFor / played).toFixed(1) : "—"}
          detail={played ? `${(pointsAgainst / played).toFixed(1)} allowed` : "No scores"}
        />
      </TileStrip>

      {data.leaders.length > 0 && (
        <Section title="Leaders">
          <ul className="grid gap-2 @tablet:grid-cols-3">
            {data.leaders.map((leader) => (
              <li key={leader.key} className="rounded-xl border border-border bg-surface p-3">
                <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                  {leader.label}
                </div>
                <div className="num mt-1 font-display text-3xl leading-none font-bold">
                  {formatStat(leader.stat as StatKey, leader.value)}
                </div>
                <Link
                  to="/players/$playerId"
                  params={{ playerId: leader.player.playerId }}
                  className="mt-2 block hover:underline"
                >
                  <PlayerChip
                    size="sm"
                    player={{
                      displayName: leader.player.name,
                      position: leader.player.position,
                      headshotUrl: leader.player.headshotUrl,
                    }}
                  />
                </Link>
              </li>
            ))}
          </ul>
        </Section>
      )}

      {countdowns && countdowns.length > 0 && (
        <Section title="Countdowns" variant="card">
          <CountdownList items={countdowns.slice(0, SHOWN_COUNTDOWNS)} />
        </Section>
      )}

      {running.length > 0 && (
        <Section title="Running now">
          <ul className="flex flex-wrap gap-2">
            {running.map((s) => (
              <li key={s.id} className="min-w-0">
                <FactChip
                  value={s.current}
                  label={STREAK_LABELS[s.key as StreakKey] ?? s.key}
                  detail={s.who}
                  active
                />
              </li>
            ))}
          </ul>
        </Section>
      )}

      {data.setThisSeason.length > 0 && (
        <Section title="Set this season">
          <ul className="divide-y divide-border rounded-xl border border-border bg-surface">
            {data.setThisSeason.map((m) => (
              <li key={m._id} className="flex items-baseline justify-between gap-3 px-3 py-2 text-sm">
                <span className="min-w-0 font-medium">{m.title}</span>
                {m.weekKey && (
                  <span className="shrink-0 text-xs text-muted-foreground">
                    {weekLabel(m.weekKey, "short")}
                  </span>
                )}
              </li>
            ))}
          </ul>
        </Section>
      )}

      {ranks.length > 0 && (
        <Section title="Around the league">
          <div className="rounded-xl border border-border bg-surface p-4">
            <RankTrend rows={ranks} year={season.year} />
          </div>
        </Section>
      )}
    </div>
  );
}

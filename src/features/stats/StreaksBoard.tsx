import { Flame } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MIN_ACTIVE_STREAK, sharedRanks, STREAK_LABELS, type StreakKey } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { RankedList } from "@/components/data/RankedList";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { MissingBoxScores } from "./MissingBoxScores";

const ALL_TIME = "all";
/** Runs shown before "Show all": every starter has a few going. */
const SHOWN = 12;

const label = (key: string) => STREAK_LABELS[key as StreakKey] ?? key;

/** Every run still going, the team's and the roster's, longest first, each with where it began. */
function RunningNow() {
  const data = useQuery(api.stats.streaks.running, {});
  const [all, setAll] = useState(false);
  if (data === undefined) return <Skeleton className="h-40 rounded-xl" />;
  const rows = [
    ...data.team
      .filter((s) => s.current >= MIN_ACTIVE_STREAK)
      .map((s) => ({ ...s, who: "Team", playerId: undefined, id: `team-${s.key}` })),
    ...data.players.map((s) => ({
      ...s,
      who: s.player.name,
      playerId: s.player._id,
      id: `${s.player._id}-${s.key}`,
    })),
  ].sort((a, b) => b.current - a.current);
  if (rows.length === 0) {
    return (
      <p className="text-sm text-muted-foreground">
        Nothing running. A streak shows here at {MIN_ACTIVE_STREAK} in a row.
      </p>
    );
  }
  const ranked = sharedRanks(rows, (r) => r.current);
  return (
    <div className="space-y-2">
      <RankedList
        title="Running now"
        label="Streaks running now"
        items={(all ? ranked : ranked.slice(0, SHOWN)).map((r) => ({
          key: r.id,
          rank: r.rank,
          name: r.who,
          playerId: r.playerId,
          detail: (
            <span className="truncate">{`${label(r.key)}${r.since ? ` · since ${r.since}` : ""}`}</span>
          ),
          value: r.current,
        }))}
      />
      {ranked.length > SHOWN && (
        <Button size="sm" variant="ghost" onClick={() => setAll(!all)}>
          {all ? "Show fewer" : `Show all ${ranked.length}`}
        </Button>
      )}
    </div>
  );
}

/** The longest runs of every kind, of all time or of one season. */
function Longest() {
  const { seasons } = useSeason();
  const startYear = useFranchise()?.franchise.startYear ?? 0;
  const [seasonId, setSeasonId] = useState<string>(ALL_TIME);
  const data = useQuery(
    api.stats.streaks.longest,
    seasonId === ALL_TIME ? {} : { seasonId: seasonId as Id<"seasons"> },
  );
  const options = [
    { value: ALL_TIME, label: "All time" },
    ...seasons
      .filter((s) => s.year >= startYear)
      .map((s) => ({ value: s._id as string, label: String(s.year) }))
      .reverse(),
  ];
  const empty = data !== undefined && data.team.length === 0 && data.players.length === 0;
  return (
    <div className="space-y-3">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <h3 className="font-display text-lg font-semibold tracking-wide uppercase">Longest</h3>
        <Select
          className="w-32"
          aria-label="Streaks from"
          value={seasonId}
          options={options}
          onValueChange={setSeasonId}
        />
      </div>
      {data === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : empty ? (
        <EmptyState icon={Flame} title="No streaks yet" description="Two in a row starts a streak." />
      ) : (
        <div className="grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
          {data.team.length > 0 && (
            <RankedList
              title="Team"
              label="Longest team streaks"
              items={data.team.map((r) => ({
                key: r.key,
                name: label(r.key),
                detail: r.span ? <span className="truncate">{r.span}</span> : undefined,
                value: r.longest,
              }))}
            />
          )}
          {data.players.map((list) => (
            <RankedList
              key={list.key}
              title={label(list.key)}
              label={`Longest: ${label(list.key)}`}
              items={list.entries.map((e) => ({
                key: `${e.player._id}-${e.span ?? ""}`,
                rank: e.rank,
                name: e.player.name,
                playerId: e.player._id,
                detail: e.span ? <span className="truncate">{e.span}</span> : undefined,
                value: e.longest,
              }))}
            />
          ))}
        </div>
      )}
    </div>
  );
}

/** Stats → Streaks (FEATURES.md 5.5): what is running now and the longest runs, with their dates. */
export function StreaksBoard() {
  return (
    <div className="space-y-6">
      <MissingBoxScores />
      <Section title="Active">
        <RunningNow />
      </Section>
      <Longest />
    </div>
  );
}

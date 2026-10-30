import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { playPeriodLabel } from "@shared/games/scoringPlay";
import {
  SCORING_GROUPS,
  SCORING_LIST_KEYS,
  SCORING_LISTS,
  TEAM_RECORD_STATS,
  type ScoringListKey,
  type TeamRecordStat,
} from "@shared/stats";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { useQuery } from "@/lib/convex/useQuery";
import type { Split } from "./split";

type ListView = FunctionReturnType<typeof api.stats.scoring.records>[number];
type TeamList = FunctionReturnType<typeof api.stats.teamRecords.lists>[number];
type Entry = ListView["entries"][number] | TeamList["entries"][number];

/** The team's lists shown beside the plays; the Team view takes the rest in a later sprint. */
const TEAM_LISTS: readonly TeamRecordStat[] = ["pointsInQuarter", "comeback", "blownLead"];

const where = (e: Entry) =>
  [
    e.weekKey ? weekLabel(e.weekKey) : null,
    e.opponent ? `vs ${e.opponent.abbr}` : null,
    e.period ? playPeriodLabel(e.period) : null,
    e.year,
  ]
    .filter(Boolean)
    .join(" · ");

function Holder({ entry }: { entry: Entry }) {
  if (!("player" in entry) || !entry.player) {
    return (
      <span className="truncate">{"rawName" in entry && entry.rawName ? entry.rawName : "The team"}</span>
    );
  }
  return (
    <Link
      to="/players/$playerId"
      params={{ playerId: entry.player.playerId }}
      className="truncate hover:underline pointer-coarse:touch-target"
    >
      {entry.passer ? `${entry.passer.name} to ${entry.player.name}` : entry.player.name}
    </Link>
  );
}

function ScoringList({ label, unit, entries }: { label: string; unit: string; entries: readonly Entry[] }) {
  return (
    <section
      className="overflow-hidden rounded-xl border border-border bg-surface"
      aria-label={`${label} records`}
    >
      <h4 className="border-b border-border px-4 py-2.5 text-sm font-medium">{label}</h4>
      <ol className="divide-y divide-border">
        {entries.map((e) => (
          <li key={e.rank} className="flex min-h-11 items-center gap-2.5 px-3 py-1.5">
            <span
              className={cn(
                "num w-5 shrink-0 text-right font-display text-base font-bold",
                e.rank === 1 ? "text-primary" : "text-subtle-foreground",
              )}
            >
              {e.rank}
            </span>
            <span className="min-w-0 flex-1">
              <span className="flex min-w-0 items-center text-sm">
                <Holder entry={e} />
              </span>
              <span className="block truncate text-xs text-muted-foreground">
                {e.gameId ? (
                  <Link to="/games/$gameId" params={{ gameId: e.gameId }} className="hover:underline">
                    {where(e)}
                  </Link>
                ) : (
                  where(e)
                )}
              </span>
            </span>
            <span className="num shrink-0 font-display text-lg font-bold">
              {e.value}
              <span className="ml-1 text-xs font-medium text-muted-foreground">{unit}</span>
            </span>
          </li>
        ))}
      </ol>
    </section>
  );
}

/** The records only scoring plays can tell: under the books, once a summary has been captured. */
export function ScoringRecords({ split }: { split: Split }) {
  const lists = useQuery(api.stats.scoring.records, { split });
  const team = useQuery(api.stats.teamRecords.lists, { split, scope: "game" });
  if (lists === undefined || team === undefined) return <Skeleton className="h-40 rounded-xl" />;
  const teamLists = team.filter((l) => TEAM_LISTS.includes(l.statKey as TeamRecordStat));
  if (lists.length === 0 && teamLists.length === 0) return null;
  const order = (l: ListView) => SCORING_LIST_KEYS.indexOf(l.list as ScoringListKey);
  return (
    <Section
      title="Scoring plays"
      description="From the scoring summaries you have captured, so franchise games only."
    >
      <div className="space-y-4">
        {SCORING_GROUPS.map(({ key, label }) => {
          const group = lists
            .filter((l) => SCORING_LISTS[l.list as ScoringListKey].group === key)
            .sort((a, b) => order(a) - order(b));
          if (group.length === 0) return null;
          return (
            <div key={key} className="space-y-2">
              <h4 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                {label}
              </h4>
              <div className="@container grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
                {group.map((list) => {
                  const def = SCORING_LISTS[list.list as ScoringListKey];
                  return (
                    <ScoringList key={list.list} label={def.label} unit={def.unit} entries={list.entries} />
                  );
                })}
              </div>
            </div>
          );
        })}
        {teamLists.length > 0 && (
          <div className="space-y-2">
            <h4 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              The team
            </h4>
            <div className="@container grid gap-3 @lg:grid-cols-2 @4xl:grid-cols-3">
              {teamLists.map((list) => (
                <ScoringList
                  key={list.statKey}
                  label={TEAM_RECORD_STATS[list.statKey as TeamRecordStat].label}
                  unit="pts"
                  entries={list.entries}
                />
              ))}
            </div>
          </div>
        )}
      </div>
    </Section>
  );
}

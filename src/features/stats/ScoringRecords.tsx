import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { playPeriodLabel } from "@shared/games/scoringPlay";
import { SCORING_GROUPS, SCORING_LIST_KEYS, SCORING_LISTS, type ScoringListKey } from "@shared/stats";
import { RankedList } from "@/components/data/RankedList";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import type { Split } from "./split";

type ListView = FunctionReturnType<typeof api.stats.scoring.records>[number];
type Entry = ListView["entries"][number];

const where = (e: Entry) =>
  [
    e.weekKey ? weekLabel(e.weekKey) : null,
    e.opponent ? `vs ${e.opponent.abbr}` : null,
    e.period ? playPeriodLabel(e.period) : null,
    e.year,
  ]
    .filter(Boolean)
    .join(" · ");

const holder = (e: Entry) => {
  if (!e.player) return e.rawName ?? "The team";
  return e.passer ? `${e.passer.name} to ${e.player.name}` : e.player.name;
};

function ScoringList({ list }: { list: ListView }) {
  const { label, unit } = SCORING_LISTS[list.list as ScoringListKey];
  return (
    <RankedList
      title={label}
      label={`${label} records`}
      items={list.entries.map((e) => ({
        key: String(e.rank),
        rank: e.rank,
        name: holder(e),
        playerId: e.player?.playerId,
        detail: <span className="truncate">{where(e)}</span>,
        gameId: e.gameId ?? undefined,
        value: `${e.value} ${unit}`,
      }))}
    />
  );
}

/** The records only scoring plays can tell: under the books, once a summary has been captured. */
export function ScoringRecords({ split }: { split: Split }) {
  const lists = useQuery(api.stats.scoring.records, { split });
  if (lists === undefined) return <Skeleton className="h-40 rounded-xl" />;
  if (lists.length === 0) return null;
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
                {group.map((list) => (
                  <ScoringList key={list.list} list={list} />
                ))}
              </div>
            </div>
          );
        })}
      </div>
    </Section>
  );
}

import { BarChart3 } from "lucide-react";
import { useMemo } from "react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { formatRecord, formatSigned } from "@shared/stats";
import { useSeason } from "@/app/season";
import type { DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { FactChip } from "@/components/data/FactChip";
import { QuarterGrid } from "@/components/data/QuarterGrid";
import { SplitTable } from "@/components/data/SplitTable";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { useQuery } from "@/lib/convex/useQuery";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

type Data = FunctionReturnType<typeof api.stats.splits.team>;
type Group = Data["sections"][number]["groups"][number];
type Range = "season" | "all";

const perGame = (points: number, g: Group) => points / g.games;
const oneDecimal = (n: number | null) => (n === null ? "–" : n.toFixed(1));

const number = (
  id: string,
  header: string,
  title: string,
  value: (g: Group) => number | null,
  format: (n: number | null) => string = (n) => (n === null ? "–" : String(n)),
): DataColumn<Group> => ({
  id,
  header,
  title,
  align: "right",
  sortDescFirst: true,
  value,
  cell: (g) => <span className="num">{format(value(g))}</span>,
});

const COLUMNS: DataColumn<Group>[] = [
  number("games", "G", "Games", (g) => g.games),
  {
    id: "record",
    header: "Rec",
    title: "Record",
    align: "right",
    value: (g) => g.wins / g.games,
    sortDescFirst: true,
    cell: (g) => <span className="num">{formatRecord({ w: g.wins, l: g.losses, t: g.ties })}</span>,
  },
  number("pointsFor", "PF", "Points scored", (g) => g.pointsFor),
  number("pointsAgainst", "PA", "Points allowed", (g) => g.pointsAgainst),
  number(
    "diff",
    "Diff",
    "Point differential",
    (g) => g.pointsFor - g.pointsAgainst,
    (n) => formatSigned(n ?? 0),
  ),
  number("ppg", "PF/G", "Points scored per game", (g) => perGame(g.pointsFor, g), oneDecimal),
  number("oppg", "PA/G", "Points allowed per game", (g) => perGame(g.pointsAgainst, g), oneDecimal),
  number("ypg", "Y/G", "Yards per game", (g) => g.yardsPerGame, oneDecimal),
  number("oypg", "OY/G", "Yards allowed per game", (g) => g.allowedPerGame, oneDecimal),
];
const PRIMARY = ["games", "record", "diff"];

const RANGES: { value: Range; label: string }[] = [
  { value: "season", label: "This season" },
  { value: "all", label: "All seasons" },
];

/** The team by quarter and by split (STATS-HUB.md 4.6, 4.7), one season or all of them. */
export function TeamSplits() {
  const { season } = useSeason();
  const [range, setRange] = useLocalStorage<Range>("ft.team-splits-range", "season");
  const seasonId = range === "season" && season ? season._id : "all";
  const data = useQuery(api.stats.splits.team, { seasonId });
  const sections = useMemo(() => data?.sections ?? [], [data]);
  const picker = (
    <Segmented size="sm" aria-label="Seasons" value={range} onChange={setRange} options={RANGES} />
  );
  if (data === undefined) return <Skeleton className="h-64 rounded-xl" />;
  if (sections.length === 0) {
    return (
      <Section title="Splits" actions={picker}>
        <EmptyState
          icon={BarChart3}
          title="No games to split"
          description="Splits build up from each game's final score."
        />
      </Section>
    );
  }
  const { quarters } = data;
  return (
    <div className="space-y-8">
      <Section title="Splits" description="Regular season unless the row says playoffs." actions={picker}>
        <SplitTable
          id="team-splits"
          caption="Team splits"
          sections={sections}
          columns={COLUMNS}
          primaryColumns={PRIMARY}
        />
      </Section>
      <Section
        title="By quarter"
        description={
          quarters.games > 0
            ? `Regular season, over the ${quarters.games} games with quarter scores.`
            : undefined
        }
      >
        {quarters.periods.length === 0 ? (
          <EmptyState
            icon={BarChart3}
            title="No quarter scores"
            description="Capture a game's scoring summary, or type its quarters on the game page."
          />
        ) : (
          <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
            <QuarterGrid periods={quarters.periods} />
            <div className="flex flex-wrap gap-2">
              <FactChip label="First half" value={formatSigned(quarters.firstHalf)} />
              <FactChip label="Second half" value={formatSigned(quarters.secondHalf)} />
            </div>
          </div>
        )}
      </Section>
    </div>
  );
}

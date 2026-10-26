import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Swords } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekIndex, weekLabel } from "@shared/domain";
import { formatRecord, formatSigned, winPct } from "@shared/stats";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Sparkline } from "@/components/data/Sparkline";
import { ResultBadge } from "@/components/team/ResultBadge";
import { TeamLink } from "./TeamLink";

type Row = FunctionReturnType<typeof api.league.rivals.list>[number];

const meetings = (r: Row) => r.record.w + r.record.l + r.record.t;

const columns: DataColumn<Row>[] = [
  {
    id: "team",
    header: "Opponent",
    value: (r) => r.opponent.name,
    cell: (r) => <TeamLink team={r.opponent} label="name" size="xs" />,
    minWidth: 150,
  },
  {
    id: "games",
    header: "GP",
    title: "Meetings",
    align: "right",
    sortDescFirst: true,
    value: meetings,
  },
  {
    id: "record",
    header: "W-L-T",
    title: "All-time record",
    align: "right",
    sortDescFirst: true,
    value: (r) => winPct(r.record) ?? 0,
    cell: (r) => formatRecord(r.record),
  },
  {
    id: "diff",
    header: "Diff",
    title: "Point differential",
    align: "right",
    sortDescFirst: true,
    value: (r) => r.pointsFor - r.pointsAgainst,
    cell: (r) => formatSigned(r.pointsFor - r.pointsAgainst),
  },
  {
    id: "streak",
    header: "Strk",
    title: "Current streak",
    align: "right",
    value: (r) => r.streak,
  },
  {
    id: "margins",
    header: "Margins",
    title: "Margin of each meeting, oldest first",
    sortable: false,
    value: (r) => r.margins.join(" "),
    cell: (r) => (
      <Sparkline values={r.margins} width={80} height={22} aria-label={`Margins ${r.margins.join(", ")}`} />
    ),
  },
  {
    id: "playoffs",
    header: "Playoffs",
    title: "Playoff record against them",
    align: "right",
    sortDescFirst: true,
    value: (r) => r.playoff.w + r.playoff.l + r.playoff.t,
    cell: (r) => (r.playoff.w + r.playoff.l + r.playoff.t > 0 ? formatRecord(r.playoff) : "—"),
  },
  {
    id: "last",
    header: "Last",
    title: "Last meeting",
    align: "right",
    value: (r) => r.last.year * 100 + weekIndex(r.last.weekKey),
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="num text-xs text-muted-foreground">
          {r.last.year} {weekLabel(r.last.weekKey)}
        </span>
        <ResultBadge result={r.last.result} us={r.last.us} them={r.last.them} />
      </span>
    ),
  },
];

/**
 * Rivalries (Sprint 8): the franchise's head-to-head line against every opponent it has met,
 * from captured games. Each team opens its page with every meeting listed.
 */
export function RivalsView() {
  const rivals = useQuery(api.league.rivals.list, {});
  return (
    <DataTable<Row>
      id="league-rivals"
      data={rivals}
      columns={columns}
      getRowId={(r) => r.opponent.abbr}
      identityColumn="team"
      primaryColumns={["record", "diff", "streak"]}
      initialSort={{ id: "games", desc: true }}
      caption="Head to head"
      emptyState={
        <EmptyState
          icon={Swords}
          title="No rivals yet"
          description="Every opponent you play shows up here with the all-time record against them."
        />
      }
    />
  );
}

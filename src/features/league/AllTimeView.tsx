import { formatRecord, winPct } from "@shared/stats";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { TeamLink } from "./TeamLink";
import type { Overview } from "./types";

type Row = Overview["table"][number];

const count = (id: keyof Row & string, header: string, title: string): DataColumn<Row> => ({
  id,
  header,
  title,
  align: "right",
  sortDescFirst: true,
  value: (r) => r[id] as number,
});

const columns: DataColumn<Row>[] = [
  {
    id: "team",
    header: "Team",
    value: (r) => r.team.name,
    cell: (r) => <TeamLink team={r.team} label="name" size="xs" />,
    minWidth: 160,
  },
  count("seasons", "Yrs", "Seasons"),
  {
    id: "record",
    header: "W-L-T",
    title: "Record",
    align: "right",
    value: (r) => winPct(r) ?? 0,
    cell: (r) => formatRecord(r),
    sortDescFirst: true,
  },
  count("playoffs", "Trips", "Playoff appearances"),
  {
    id: "playoffRecord",
    header: "Playoffs",
    title: "Playoff record",
    align: "right",
    value: (r) => r.playoffW,
    cell: (r) => `${r.playoffW}-${r.playoffL}`,
    sortDescFirst: true,
  },
  count("divisionTitles", "Div", "Division titles"),
  count("conferenceTitles", "Conf", "Conference titles"),
  count("superBowls", "SB", "Super Bowls"),
];

/** The cumulative league table (FEATURES.md 5.6): records, playoff runs and titles across seasons. */
export function AllTimeView({ overview }: { overview: Overview }) {
  return (
    <DataTable<Row>
      id="league-all-time"
      data={overview.table}
      columns={columns}
      getRowId={(r) => r.team.abbr}
      identityColumn="team"
      primaryColumns={["record", "superBowls"]}
      initialSort={{ id: "superBowls", desc: true }}
      caption="All-time table"
    />
  );
}

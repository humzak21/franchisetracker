import { Trophy } from "lucide-react";
import { isPreFranchise } from "@shared/history/nflverse";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Badge } from "@/components/ui/misc";
import { TeamLink } from "./TeamLink";
import type { Overview } from "./types";

type Row = Overview["champions"][number];

const team = (key: "afc" | "nfc" | "superBowl") => (r: Row) =>
  r[key] ? (
    <TeamLink team={r[key]} label="name" size="xs" />
  ) : (
    <span className="text-subtle-foreground">—</span>
  );

/** Who won the AFC, the NFC and the Super Bowl, every season the franchise knows (FEATURES.md 5.6). */
export function ChampionsView({ overview }: { overview: Overview }) {
  if (overview.champions.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="No champions yet"
        description="Champions appear once a season's playoff results are in."
      />
    );
  }
  const columns: DataColumn<Row>[] = [
    {
      id: "year",
      header: "Year",
      value: (r) => r.year,
      cell: (r) => (
        <span className="inline-flex items-center gap-2">
          <span className="num font-display text-lg font-bold">{r.year}</span>
          {isPreFranchise(r.year, overview.startYear) && <Badge>NFL</Badge>}
        </span>
      ),
    },
    {
      id: "afc",
      header: "AFC",
      title: "AFC champion",
      value: (r) => r.afc?.name ?? "",
      cell: team("afc"),
      minWidth: 150,
    },
    {
      id: "nfc",
      header: "NFC",
      title: "NFC champion",
      value: (r) => r.nfc?.name ?? "",
      cell: team("nfc"),
      minWidth: 150,
    },
    {
      id: "sb",
      header: "Super Bowl",
      value: (r) => r.superBowl?.name ?? "",
      cell: team("superBowl"),
      minWidth: 150,
    },
  ];
  return (
    <DataTable<Row>
      id="league-champions"
      data={overview.champions}
      columns={columns}
      getRowId={(r) => String(r.year)}
      identityColumn="year"
      primaryColumns={["sb"]}
      columnOptions={false}
      caption="Champions"
    />
  );
}

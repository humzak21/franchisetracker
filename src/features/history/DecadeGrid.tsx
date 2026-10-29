import { useNavigate } from "@tanstack/react-router";
import { Pencil } from "lucide-react";
import { useMemo } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { formatSchemes } from "@shared/domain";
import { isPreFranchise } from "@shared/history/nflverse";
import { finishTiers, playoffFinishLabel } from "@shared/history/seasonRecord";
import type { DecadeTotals } from "@shared/history/trophies";
import { formatOrdinal, formatRecord } from "@shared/stats";
import { useSeason } from "@/app/season";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { Highlight } from "@/components/data/Highlight";
import { Button } from "@/components/ui/button";
import { useElementWidth } from "@/lib/hooks/useElementWidth";
import { DecadeSeasonCard } from "./DecadeSeasonCard";
import { PlayoffFinish } from "./PlayoffFinish";
import { RealBadge } from "./RealBadge";

type Season = Doc<"seasons">;
type Row = Season | { _id: "totals"; totals: DecadeTotals };

const isTotals = (row: Row): row is { _id: "totals"; totals: DecadeTotals } => row._id === "totals";
const rec = (row: Row) => (isTotals(row) ? row.totals : row.userRecord);

/** The seed and playoff result as text, for sorting and search. */
function result(season: Season): string {
  const r = season.userRecord;
  if (!r?.playoffResult) return "";
  const seed = r.seed ? `${formatOrdinal(r.seed)} seed · ` : "";
  return `${seed}${playoffFinishLabel(r.playoffResult, season.year)}`;
}

const columns = (startYear: number, onEdit: (season: Season) => void): DataColumn<Row>[] => [
  {
    id: "year",
    header: "Year",
    value: (r) => (isTotals(r) ? "Total" : r.year),
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="num font-display text-lg font-bold">{isTotals(r) ? "Total" : r.year}</span>
        {!isTotals(r) && isPreFranchise(r.year, startYear) && <RealBadge />}
      </span>
    ),
  },
  { id: "w", header: "W", title: "Wins", align: "right", value: (r) => rec(r)?.w ?? null },
  { id: "l", header: "L", title: "Losses", align: "right", value: (r) => rec(r)?.l ?? null },
  { id: "t", header: "T", title: "Ties", align: "right", value: (r) => rec(r)?.t ?? null },
  {
    id: "div",
    header: "Div",
    title: "Division finish",
    align: "right",
    value: (r) => (isTotals(r) ? null : (r.userRecord?.divisionRank ?? null)),
    cell: (r) =>
      isTotals(r) || !r.userRecord?.divisionRank ? (
        ""
      ) : (
        <Highlight tier={finishTiers(r.userRecord).division}>
          {formatOrdinal(r.userRecord.divisionRank)}
        </Highlight>
      ),
  },
  {
    id: "playoffs",
    header: "Playoffs",
    value: (r) => (isTotals(r) ? `${r.totals.playoffs} trips, ${r.totals.titles} titles` : result(r)),
    cell: (r) =>
      isTotals(r) ? (
        `${r.totals.playoffs} trips, ${r.totals.titles} titles`
      ) : r.userRecord ? (
        <PlayoffFinish year={r.year} record={r.userRecord} />
      ) : (
        ""
      ),
    minWidth: 300,
  },
  { id: "coach", header: "Coach", value: (r) => (isTotals(r) ? "" : (r.coaching?.headCoach ?? "")) },
  {
    id: "scheme",
    header: "Scheme",
    title: "Offensive / defensive scheme",
    value: (r) => (isTotals(r) ? "" : formatSchemes(r.coaching)),
  },
  { id: "note", header: "Note", value: (r) => (isTotals(r) ? "" : (r.notes ?? "")), minWidth: 240 },
  {
    id: "edit",
    header: "",
    title: "Edit",
    sortable: false,
    value: () => null,
    cell: (r) =>
      isTotals(r) ? null : (
        <Button
          variant="ghost"
          size="icon-sm"
          aria-label={`Edit ${r.year}`}
          onClick={(e) => {
            e.stopPropagation();
            onEdit(r);
          }}
        >
          <Pencil />
        </Button>
      ),
  },
];

/**
 * One decade of seasons: a grid on wide screens, stacked season cards on phones. Real NFL seasons
 * before the franchise are marked and open their imported season stats; played ones open the schedule.
 * Every season edits from its pencil.
 */
export function DecadeGrid({
  seasons,
  totals,
  startYear,
  onEdit,
}: {
  seasons: Season[];
  totals: DecadeTotals;
  startYear: number;
  onEdit: (season: Season) => void;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const { setYearFor } = useSeason();
  const navigate = useNavigate();
  const cols = useMemo(() => columns(startYear, onEdit), [startYear, onEdit]);
  const open = (season: Season) => {
    const to = isPreFranchise(season.year, startYear) ? "/stats" : "/schedule";
    setYearFor(to.slice(1), season.year);
    void navigate({ to });
  };

  return (
    <div ref={ref}>
      {compact ? (
        <div className="space-y-2">
          {seasons.map((season) => (
            <DecadeSeasonCard
              key={season._id}
              season={season}
              real={isPreFranchise(season.year, startYear)}
              onOpen={() => open(season)}
              onEdit={() => onEdit(season)}
            />
          ))}
          <div className="num flex justify-between rounded-xl bg-surface-2 px-4 py-3 text-sm font-semibold">
            <span>Decade</span>
            <span>
              {formatRecord(totals)} · {totals.playoffs} playoff trips · {totals.titles} titles
            </span>
          </div>
        </div>
      ) : (
        <DataTable<Row>
          id="history-decade"
          data={seasons}
          columns={cols}
          getRowId={(r) => r._id}
          identityColumn="year"
          primaryColumns={["w", "l", "playoffs"]}
          totals={{ _id: "totals", totals }}
          columnOptions={false}
          onRowClick={(r) => !isTotals(r) && open(r)}
        />
      )}
    </div>
  );
}

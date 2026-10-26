import { useNavigate } from "@tanstack/react-router";
import { useMemo } from "react";
import type { Doc } from "@convex/_generated/dataModel";
import { PLAYOFF_RESULT_LABELS } from "@shared/domain";
import { isPreFranchise } from "@shared/history/nflverse";
import type { DecadeTotals } from "@shared/history/trophies";
import { formatOrdinal, formatRecord } from "@shared/stats";
import { useSeason } from "@/app/season";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { Badge } from "@/components/ui/misc";
import { useElementWidth } from "@/lib/hooks/useElementWidth";

type Season = Doc<"seasons">;
type Row = Season | { _id: "totals"; totals: DecadeTotals };

const isTotals = (row: Row): row is { _id: "totals"; totals: DecadeTotals } => row._id === "totals";
const rec = (row: Row) => (isTotals(row) ? row.totals : row.userRecord);

function result(season: Season): string {
  const r = season.userRecord;
  if (!r?.playoffResult) return "";
  const seed = r.seed ? `${formatOrdinal(r.seed)} seed · ` : "";
  return `${seed}${PLAYOFF_RESULT_LABELS[r.playoffResult]}`;
}

/** Marks a real NFL season from before the franchise (imported, not played). */
function RealBadge() {
  return (
    <Badge
      className="border border-dashed border-border-strong bg-transparent"
      title="Real NFL season before the franchise"
    >
      NFL
    </Badge>
  );
}

const columns = (startYear: number): DataColumn<Row>[] => [
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
    cell: (r) => (isTotals(r) || !r.userRecord?.divisionRank ? "" : formatOrdinal(r.userRecord.divisionRank)),
  },
  {
    id: "playoffs",
    header: "Playoffs",
    value: (r) => (isTotals(r) ? `${r.totals.playoffs} trips, ${r.totals.titles} titles` : result(r)),
    minWidth: 220,
  },
  { id: "coach", header: "Coach", value: (r) => (isTotals(r) ? "" : (r.coaching?.headCoach ?? "")) },
  { id: "note", header: "Note", value: (r) => (isTotals(r) ? "" : (r.notes ?? "")), minWidth: 240 },
];

function SeasonCard({ season, real, onOpen }: { season: Season; real: boolean; onOpen: () => void }) {
  const r = season.userRecord;
  return (
    <button
      type="button"
      onClick={onOpen}
      className="w-full rounded-xl border border-border bg-surface p-4 text-left"
    >
      <div className="flex items-center justify-between gap-3">
        <span className="inline-flex items-center gap-2">
          <span className="num font-display text-2xl font-bold">{season.year}</span>
          {real && <RealBadge />}
        </span>
        <span className="num font-display text-2xl font-bold">{r ? formatRecord(r) : "—"}</span>
      </div>
      <div className="mt-1 flex flex-wrap items-center gap-1.5 text-sm text-muted-foreground">
        {r?.divisionRank && <Badge>{formatOrdinal(r.divisionRank)} in division</Badge>}
        {r?.playoffResult && (
          <Badge
            tone={
              r.playoffResult === "champion" ? "solid" : r.playoffResult === "missed" ? "neutral" : "accent"
            }
          >
            {PLAYOFF_RESULT_LABELS[r.playoffResult]}
          </Badge>
        )}
        {season.coaching?.headCoach && <span className="text-xs">Coach {season.coaching.headCoach}</span>}
      </div>
      {season.notes && <p className="mt-2 line-clamp-3 text-sm text-muted-foreground">{season.notes}</p>}
    </button>
  );
}

/**
 * One decade of seasons: a grid on wide screens, stacked season cards on phones. Real NFL seasons
 * before the franchise are marked and open their imported season stats; played ones open the schedule.
 */
export function DecadeGrid({
  seasons,
  totals,
  startYear,
}: {
  seasons: Season[];
  totals: DecadeTotals;
  startYear: number;
}) {
  const { ref, compact } = useElementWidth<HTMLDivElement>();
  const { setYearFor } = useSeason();
  const navigate = useNavigate();
  const cols = useMemo(() => columns(startYear), [startYear]);
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
            <SeasonCard
              key={season._id}
              season={season}
              real={isPreFranchise(season.year, startYear)}
              onOpen={() => open(season)}
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

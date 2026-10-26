import { Link } from "@tanstack/react-router";
import { FileText } from "lucide-react";
import { api } from "@convex/_generated/api";
import { PLAYOFF_RESULT_LABELS } from "@shared/domain";
import { SEASON_STATUS_LABELS } from "@shared/seasons/lifecycle";
import { formatRecord, formatSigned } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { StaffLine } from "@/components/team/StaffLine";
import { Badge } from "@/components/ui/misc";
import { Skeleton } from "@/components/ui/misc";
import type { ArchiveRow } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

function PromptBadge({ label, answered, due }: { label: string; answered: boolean; due: boolean }) {
  if (answered) return <Badge tone="win">{label} filed</Badge>;
  return due ? <Badge tone="warn">{label} due</Badge> : null;
}

function ReportCard({ row }: { row: ArchiveRow }) {
  const { season, summary } = row;
  const result = season.userRecord?.playoffResult;
  return (
    <Link
      to="/history/reports/$year"
      params={{ year: String(season.year) }}
      className="block rounded-xl border border-border bg-surface p-4 transition-colors hover:bg-surface-2"
    >
      <div className="flex items-start justify-between gap-3">
        <div>
          <div className="num font-display text-3xl leading-none font-bold">{season.year}</div>
          <div className="mt-1 text-xs text-muted-foreground">
            {SEASON_STATUS_LABELS[season.status]}
            {result ? ` · ${PLAYOFF_RESULT_LABELS[result]}` : ""}
          </div>
        </div>
        <div className="text-right">
          <div className="num font-display text-2xl leading-none font-bold">
            {summary.played > 0 ? formatRecord(summary.regular) : "—"}
          </div>
          {summary.played > 0 && (
            <div className="num mt-1 text-xs text-muted-foreground">
              {formatSigned(summary.pointsFor - summary.pointsAgainst)} pts
            </div>
          )}
        </div>
      </div>
      <div className="mt-3 flex flex-wrap gap-1.5">
        <PromptBadge label="Pre-season" answered={row.preseason.answered} due />
        <PromptBadge
          label="Post-season"
          answered={row.postseason.answered}
          due={season.status === "complete"}
        />
        {row.needs.total > 0 && (
          <Badge tone={row.needs.open > 0 ? "accent" : "neutral"}>
            {row.needs.open > 0
              ? `${row.needs.open} of ${row.needs.total} needs open`
              : `${row.needs.total} needs resolved`}
          </Badge>
        )}
      </div>
      <StaffLine staff={season.coaching} className="mt-3 text-xs" />
      {(row.postseason.snippet ?? row.preseason.snippet) && (
        <p className="mt-3 line-clamp-3 text-sm text-muted-foreground">
          {row.postseason.snippet ?? row.preseason.snippet}
        </p>
      )}
    </Link>
  );
}

/** Season reports archive (FEATURES.md 5.7): every franchise season, newest first, with its report at a glance. */
export function ReportsScreen() {
  const rows = useQuery(api.seasons.reports.archive, {});
  return (
    <Page title="Season reports" eyebrow="History" back={{ to: "/history", label: "History" }}>
      {rows === undefined ? (
        <div className="grid gap-3 @desktop:grid-cols-2" aria-busy="true">
          {Array.from({ length: 4 }, (_, i) => (
            <Skeleton key={i} className="h-40 rounded-xl" />
          ))}
        </div>
      ) : rows.length === 0 ? (
        <EmptyState
          size="page"
          icon={FileText}
          title="No seasons yet"
          description="Reports start with the first franchise season."
        />
      ) : (
        <div className="@container">
          <ul className="grid gap-3 @desktop:grid-cols-2">
            {rows.map((row) => (
              <li key={row.season._id}>
                <ReportCard row={row} />
              </li>
            ))}
          </ul>
        </div>
      )}
    </Page>
  );
}

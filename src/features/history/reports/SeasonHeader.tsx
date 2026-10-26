import { Pencil } from "lucide-react";
import { useState } from "react";
import { PLAYOFF_RESULT_LABELS } from "@shared/domain";
import { SEASON_STATUS_LABELS } from "@shared/seasons/lifecycle";
import { formatRecord } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { StaffLine } from "@/components/team/StaffLine";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { StaffSheet } from "./StaffSheet";
import type { SeasonReportData } from "./types";

/** The season at the top of its report: record, where it ended, status and the staff that ran it. */
export function SeasonHeader({ data }: { data: SeasonReportData }) {
  const userTeam = useFranchise()?.userTeam;
  const { season, summary } = data;
  const [editing, setEditing] = useState(false);
  const result = season.userRecord?.playoffResult;

  return (
    <section className="@container rounded-2xl border border-border bg-surface p-4 @tablet:p-6">
      <div className="flex flex-wrap items-center gap-4">
        {userTeam && <TeamLogo team={userTeam} size="lg" />}
        <div className="min-w-0 flex-1">
          <div className="flex flex-wrap items-center gap-2">
            <Badge tone={season.status === "complete" ? "neutral" : "accent"}>
              {SEASON_STATUS_LABELS[season.status]}
            </Badge>
            {result && (
              <Badge tone={result === "champion" ? "solid" : "neutral"}>
                {PLAYOFF_RESULT_LABELS[result]}
              </Badge>
            )}
            {data.eliminated && season.status !== "complete" && <Badge tone="loss">Eliminated</Badge>}
          </div>
          <div className="mt-1 flex items-baseline gap-3">
            <span className="num font-display text-4xl leading-none font-bold">{season.year}</span>
            <span className="num font-display text-2xl leading-none font-semibold text-muted-foreground">
              {summary.played > 0 ? formatRecord(summary.regular) : "No games yet"}
            </span>
          </div>
        </div>
        <Button variant="outline" size="sm" onClick={() => setEditing(true)}>
          <Pencil /> Staff
        </Button>
      </div>
      <StaffLine staff={season.coaching} empty="No staff set for this season." className="mt-3" />
      <StaffSheet key={String(editing)} season={season} open={editing} onOpenChange={setEditing} />
    </section>
  );
}

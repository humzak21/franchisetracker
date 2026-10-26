import { Link } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { FileText } from "lucide-react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { NeedsChecklist } from "./NeedsChecklist";
import { PromptEditor } from "./PromptEditor";
import { SeasonHeader } from "./SeasonHeader";
import { SeasonSummaryPanel } from "./SeasonSummaryPanel";

/**
 * One season's report (FEATURES.md 5.7): the pre- and post-season prompts, around the league and
 * the offseason needs, with the computed season beside them. Every field autosaves on blur.
 */
export function SeasonReportScreen({ year }: { year: number }) {
  const active = useFranchise();
  const season = active?.seasons.find((s) => s.year === year && year >= active.franchise.startYear);
  const data = useQuery(api.seasons.reports.get, season ? { seasonId: season._id } : "skip");
  const saveText = useMutation(api.seasons.reports.saveText);
  const seasonId = season?._id;
  const saveAround = useCallback(
    (text: string) => (seasonId ? saveText({ seasonId, field: "aroundTheLeague", text }) : Promise.resolve()),
    [saveText, seasonId],
  );
  const back = { to: "/history/reports", label: "Reports" };

  if (active && !season) {
    return (
      <Page title={`${year} report`} back={back}>
        <EmptyState
          size="page"
          icon={FileText}
          title={`No report for ${year}`}
          description="Reports belong to seasons played in the franchise; real NFL seasons before it have none."
          action={
            <Button asChild variant="outline">
              <Link to="/history/reports">All reports</Link>
            </Button>
          }
        />
      </Page>
    );
  }

  return (
    <Page title={`${year} report`} eyebrow="Season report" back={back}>
      {data === undefined ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="@container space-y-6">
          <SeasonHeader data={data} />
          <div className="grid grid-cols-[minmax(0,1fr)] gap-6 @desktop:grid-cols-[minmax(0,1fr)_360px] @desktop:items-start">
            <div className="space-y-6">
              <PromptEditor
                seasonId={data.season._id}
                prompt="preseason"
                text={data.report?.preseasonThoughts}
                answeredAt={data.report?.prompts.preseason.answeredAt}
                canFile
              />
              <PromptEditor
                seasonId={data.season._id}
                prompt="postseason"
                text={data.report?.postseasonThoughts}
                answeredAt={data.report?.prompts.postseason.answeredAt}
                canFile={data.season.status === "complete"}
                waitingFor="Due once the Super Bowl week is done."
              />
              <Section
                title="Around the league"
                description="Other teams, rivals, the league's stories."
                variant="card"
              >
                <NotesEditor
                  label="Notes"
                  value={data.report?.aroundTheLeague}
                  rows={5}
                  onSave={saveAround}
                  placeholder="Who surprised, who collapsed, who to watch next year…"
                />
              </Section>
              <Section
                id="needs"
                title="Offseason needs"
                description="What this roster has to fix next. Resolve each with the signing, trade or pick that filled it."
              >
                <NeedsChecklist
                  seasonId={data.season._id}
                  needs={data.report?.needs ?? []}
                  resolutions={data.resolutions}
                />
              </Section>
            </div>
            <aside className="@desktop:sticky @desktop:top-24">
              <Section title="Season summary">
                <SeasonSummaryPanel data={data} />
              </Section>
            </aside>
          </div>
        </div>
      )}
    </Page>
  );
}

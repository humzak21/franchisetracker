import { Link } from "@tanstack/react-router";
import { ArrowRight, BookOpen } from "lucide-react";
import { api } from "@convex/_generated/api";
import { formatSigned } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { StaffLine } from "@/components/team/StaffLine";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { RecapEvents } from "./RecapEvents";
import { RecapPeople } from "./RecapPeople";
import { RecapWeeks } from "./RecapWeeks";
import type { Recap } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

function Hero({ recap }: { recap: Recap }) {
  const team = useFranchise()?.userTeam;
  const { season, summary, headline } = recap;
  const played = summary.pointsFor + summary.pointsAgainst > 0;
  return (
    <section className="rounded-2xl border border-border bg-surface p-4 @tablet:p-6">
      <div className="flex flex-wrap items-center gap-4">
        {team && <TeamLogo team={team} size="lg" />}
        <div className="min-w-0 flex-1">
          <div className="num font-display text-4xl leading-none font-bold">{season.year}</div>
          <p className="num mt-1 font-medium">{headline}</p>
          {played && (
            <p className="num text-sm text-muted-foreground">
              {formatSigned(summary.pointsFor - summary.pointsAgainst)} points, {summary.pointsFor} for and{" "}
              {summary.pointsAgainst} against
            </p>
          )}
        </div>
      </div>
      <StaffLine staff={season.coaching} className="mt-3" />
    </section>
  );
}

function Words({ recap }: { recap: Recap }) {
  const { preseason, postseason, aroundTheLeague } = recap.words;
  const notes = [
    { title: "Going in", text: preseason },
    { title: "Looking back", text: postseason },
    { title: "Around the league", text: aroundTheLeague },
  ].filter((n) => n.text);
  if (notes.length === 0) return null;
  return (
    <Section title="In your words">
      <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
        {notes.map((note) => (
          <div key={note.title}>
            <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {note.title}
            </h3>
            <p className="mt-1 text-sm whitespace-pre-line">{note.text}</p>
          </div>
        ))}
      </div>
    </Section>
  );
}

/**
 * A season told from what was captured (FEATURES.md 5.7): the record and how it went week to week,
 * the stars and their awards, the records set, the moves and the draft, and the report's own words.
 */
export function SeasonRecapScreen({ year }: { year: number }) {
  const recap = useQuery(api.seasons.recap.get, { year });
  const back = { to: `/history/reports/${year}`, label: `${year} report` };
  const none = recap === null || recap?.weeks.length === 0;
  return (
    <Page title={`${year} recap`} eyebrow="Season recap" back={back}>
      {recap === undefined ? (
        <div className="space-y-4" aria-busy="true">
          <Skeleton className="h-32 rounded-2xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : none ? (
        <EmptyState
          size="page"
          icon={BookOpen}
          title={`Nothing to tell for ${year} yet`}
          description="A recap comes together from the games captured in a franchise season."
          action={
            <Button asChild variant="outline">
              <Link to="/history/reports">
                All reports <ArrowRight />
              </Link>
            </Button>
          }
        />
      ) : (
        <div className="@container space-y-8">
          <Hero recap={recap} />
          <RecapWeeks recap={recap} />
          <RecapPeople recap={recap} />
          <RecapEvents recap={recap} />
          <Words recap={recap} />
        </div>
      )}
    </Page>
  );
}

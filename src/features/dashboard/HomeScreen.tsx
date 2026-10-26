import { Link } from "@tanstack/react-router";
import { Camera, Database, FileSpreadsheet, LayoutGrid } from "lucide-react";
import { formatRecord } from "@shared/stats";
import { useFranchise, type ActiveFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

function Hero({ active }: { active: ActiveFranchise }) {
  const { franchise, userTeam, seasons } = active;
  const first = seasons[0]?.year;
  const last = seasons[seasons.length - 1]?.year;
  return (
    <div
      className="@container relative overflow-hidden rounded-2xl border border-border bg-team text-team-foreground"
      style={{
        backgroundImage: `radial-gradient(120% 140% at 100% 0%, ${userTeam.secondaryColor}55, transparent 55%), linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(0 0 0 / 0.25))`,
      }}
    >
      <div
        aria-hidden
        className="absolute inset-0 [background-image:repeating-linear-gradient(90deg,currentColor_0_1px,transparent_1px_48px)] opacity-[0.07]"
      />
      <div className="relative flex flex-col gap-5 p-5 @tablet:flex-row @tablet:items-center @tablet:p-7">
        <TeamLogo team={userTeam} size="xl" className="ring-2 ring-white/25" />
        <div className="min-w-0 flex-1">
          <div className="text-[11px] font-semibold tracking-[0.14em] uppercase opacity-70">
            {userTeam.city} {userTeam.name} · {userTeam.conference} {userTeam.division}
          </div>
          <h2 className="mt-1 font-display text-4xl leading-none font-bold tracking-wide uppercase @tablet:text-5xl">
            {franchise.name}
          </h2>
        </div>
        <dl className="grid grid-cols-3 gap-4 @tablet:gap-8">
          {[
            ["Seasons", String(seasons.length)],
            ["Span", first && last ? `${first}–${String(last).slice(2)}` : "—"],
            ["Since", String(franchise.startYear)],
          ].map(([label, value]) => (
            <div key={label}>
              <dt className="text-[10px] font-semibold tracking-[0.12em] uppercase opacity-70">{label}</dt>
              <dd className="num font-display text-2xl font-bold whitespace-nowrap @tablet:text-3xl">
                {value}
              </dd>
            </div>
          ))}
        </dl>
      </div>
    </div>
  );
}

function SeasonGrid({ active }: { active: ActiveFranchise }) {
  const { season, setYear } = useSeason();
  return (
    <div className="grid grid-cols-2 gap-2 @tablet:grid-cols-5">
      {active.seasons.map((s) => (
        <button
          key={s._id}
          type="button"
          onClick={() => setYear(s.year)}
          className={cn(
            "rounded-xl border bg-surface p-3 text-left transition-colors hover:bg-surface-2",
            s.year === season?.year ? "border-primary ring-1 ring-primary" : "border-border",
          )}
        >
          <div className="flex items-center justify-between">
            <span className="num font-display text-2xl font-bold">{s.year}</span>
            <Badge>{s.status}</Badge>
          </div>
          <div className="num mt-1 text-sm text-muted-foreground">
            {s.userRecord ? formatRecord(s.userRecord) : "No games yet"}
          </div>
        </button>
      ))}
    </div>
  );
}

export function HomeScreen() {
  const active = useFranchise();
  const { season } = useSeason();

  return (
    <Page title="Home" eyebrow={season ? `${season.year} season` : undefined} season>
      {active === undefined && (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      )}
      {active === null && (
        <EmptyState
          size="page"
          icon={Database}
          title="No franchise yet"
          description={
            <>
              This deployment has not been seeded. Run{" "}
              <code className="rounded bg-surface-2 px-1">npm run seed</code> to create the 32 teams, the
              franchise and its seasons.
            </>
          }
        />
      )}
      {active && (
        <div className="@container space-y-8">
          <Hero active={active} />
          <Section title="Seasons" description="Empty shells until the workbook import fills them in.">
            <SeasonGrid active={active} />
          </Section>
          <Section title="Next steps">
            <div className="grid gap-3 @tablet:grid-cols-3">
              <EmptyState
                icon={FileSpreadsheet}
                title="Import the workbook"
                description="All ten seasons from Madden 26 Pats.xlsx. Sprint 1."
              />
              <EmptyState
                icon={Camera}
                title="Log a game from a photo"
                description="Box score screenshots, reviewed then committed. Sprint 2."
                action={
                  <Button asChild variant="primary" size="sm">
                    <Link to="/inbox">Open inbox</Link>
                  </Button>
                }
              />
              <EmptyState
                icon={LayoutGrid}
                title="Component gallery"
                description="Every primitive at desktop and phone width."
                action={
                  <Button asChild variant="outline" size="sm">
                    <Link to="/dev/components">Open gallery</Link>
                  </Button>
                }
              />
            </div>
          </Section>
        </div>
      )}
    </Page>
  );
}

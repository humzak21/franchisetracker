import type { ActiveFranchise, Season } from "@/app/franchise";
import { TeamLogo } from "@/components/team/TeamLogo";
import { paceLine } from "@shared/stats";
import { Skeleton } from "@/components/ui/misc";
import { headlineFacts } from "./headline";
import type { HomeSeason } from "./types";

/**
 * The season header (FEATURES.md 5.1) in the team's colors: logo, franchise, and the season's
 * record, division standing, streak, point differential and playoff status.
 */
export function SeasonHeader({
  active,
  season,
  data,
}: {
  active: ActiveFranchise;
  season: Season;
  data: HomeSeason | null | undefined;
}) {
  const { franchise, userTeam } = active;
  const facts = data
    ? headlineFacts({
        status: season.status,
        regular: data.summary.regular,
        stored: season.userRecord,
        pointsFor: data.summary.pointsFor,
        pointsAgainst: data.summary.pointsAgainst,
        streak: data.summary.streak,
        divisionRank: data.divisionRank,
        seed: data.seed,
        division: `${userTeam.conference} ${userTeam.division}`,
      })
    : null;
  const pace = data
    ? paceLine(data.summary.regular, data.summary.pointsFor, season.status, franchise.settings.gamesPerSeason)
    : null;

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
      <div className="relative flex flex-col gap-5 p-5 @tablet:p-6 @desktop:flex-row @desktop:items-center">
        <div className="flex min-w-0 flex-1 items-center gap-4">
          <TeamLogo team={userTeam} size="lg" className="shrink-0 ring-2 ring-white/25" />
          <div className="min-w-0">
            <div className="truncate text-[11px] font-semibold tracking-[0.14em] uppercase opacity-70">
              {season.year} · {userTeam.city} {userTeam.name}
            </div>
            <h2 className="mt-1 font-display text-3xl leading-none font-bold tracking-wide uppercase @tablet:text-5xl">
              {franchise.name}
            </h2>
            {pace && <p className="mt-2 text-sm font-medium opacity-80">{pace}</p>}
          </div>
        </div>
        {facts === null ? (
          <Skeleton className="h-14 bg-white/10 @desktop:w-[28rem]" />
        ) : (
          <dl className="grid grid-cols-3 gap-x-4 gap-y-3 @tablet:grid-cols-5 @tablet:gap-x-6">
            {facts.map((fact) => (
              <div key={fact.label} className="min-w-0">
                <dt className="truncate text-[10px] font-semibold tracking-[0.12em] uppercase opacity-70">
                  {fact.label}
                </dt>
                <dd className="num font-display text-2xl leading-tight font-bold whitespace-nowrap @tablet:text-3xl">
                  {fact.value}
                </dd>
                {fact.detail && <dd className="truncate text-[11px] opacity-70">{fact.detail}</dd>}
              </div>
            ))}
          </dl>
        )}
      </div>
    </div>
  );
}

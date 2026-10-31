import { api } from "@convex/_generated/api";
import { isPreFranchise } from "@shared/history/nflverse";
import { useFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { Countdowns } from "./Countdowns";
import { FranchiseRecord } from "./FranchiseRecord";
import { GoalsCard } from "./GoalsCard";
import { InboxSummary } from "./InboxSummary";
import { LastGameCard } from "./LastGameCard";
import { MilestoneFeed } from "./MilestoneFeed";
import { NextGameCard } from "./NextGameCard";
import { PendingPrompts } from "./PendingPrompts";
import { PointsPulse } from "./PointsPulse";
import { RankPulse } from "./RankPulse";
import { RecentActivity } from "./RecentActivity";
import { SeasonCard } from "./SeasonCard";
import { SeasonChecklist } from "./SeasonChecklist";
import { SeasonHeader } from "./SeasonHeader";
import { TeamStreaks } from "./TeamStreaks";
import { useQuery } from "@/lib/convex/useQuery";

/** A column on desktop; on narrower widths its cards join one column, ordered by `order-*`. */
const column = "contents @desktop:flex @desktop:min-w-0 @desktop:flex-col @desktop:gap-8";

/**
 * Home (FEATURES.md 5.1): the selected season at a glance. Desktop puts the season, games, pulse
 * and milestones in a main column beside the inbox, lifecycle, goals, ranks and moves; the phone
 * stacks the same cards in one column with the prompts and inbox first (5.13).
 */
export function HomeScreen() {
  const active = useFranchise();
  const { season } = useSeason();
  const data = useQuery(api.dashboard.home.season, season ? { seasonId: season._id } : "skip");
  const imported = !!(active && season && isPreFranchise(season.year, active.franchise.startYear));

  return (
    <Page title="Home" eyebrow={season ? `${season.year} season` : undefined} season>
      {!active || !season ? (
        <div className="space-y-4">
          <Skeleton className="h-40 rounded-2xl" />
          <Skeleton className="h-24 rounded-xl" />
        </div>
      ) : (
        <div className="@container">
          <div className="flex flex-col gap-8 @desktop:grid @desktop:grid-cols-[minmax(0,2fr)_minmax(0,1fr)] @desktop:items-start">
            <div className={column}>
              <div className="order-1 space-y-3 empty:hidden @desktop:order-none">
                <PendingPrompts />
              </div>
              <div className="order-3 space-y-3 @desktop:order-none">
                <SeasonHeader active={active} season={season} data={data} />
                <TeamStreaks />
              </div>
              {!imported && (
                <div className="order-4 grid grid-cols-1 gap-8 @tablet:grid-cols-2 @desktop:order-none">
                  <Section title="Last game">
                    {data === undefined ? (
                      <Skeleton className="h-40 rounded-xl" />
                    ) : (
                      <LastGameCard game={data?.lastGame ?? null} active={active} />
                    )}
                  </Section>
                  <Section title="Next up">
                    {data === undefined ? (
                      <Skeleton className="h-40 rounded-xl" />
                    ) : (
                      <NextGameCard next={data?.nextGame ?? null} />
                    )}
                  </Section>
                </div>
              )}
              {!imported && data && (
                <Section title="Season pulse" className="order-7 @desktop:order-none">
                  <PointsPulse pulse={data.pulse} />
                </Section>
              )}
              <Section title="Milestones" className="order-9 @desktop:order-none">
                <MilestoneFeed />
              </Section>
              <Section title="Franchise record" className="order-11 @desktop:order-none">
                <FranchiseRecord active={active} />
              </Section>
            </div>

            <div className={column}>
              <Section title="Inbox" className="order-2 @desktop:order-none">
                <InboxSummary />
              </Section>
              {!imported && (
                <Section title="This season" className="order-6 @desktop:order-none">
                  <SeasonCard active={active} />
                </Section>
              )}
              {!imported && (
                <SeasonChecklist
                  seasonId={season._id}
                  year={season.year}
                  className="order-6 @desktop:order-none"
                />
              )}
              {!imported && (
                <GoalsCard seasonId={season._id} year={season.year} className="order-5 @desktop:order-none" />
              )}
              {!imported && <Countdowns seasonId={season._id} className="order-7 @desktop:order-none" />}
              <Section title="Team ranks" className="order-8 @desktop:order-none">
                <RankPulse year={season.year} />
              </Section>
              {!imported && (
                <Section title="Recent moves" className="order-10 @desktop:order-none">
                  <RecentActivity seasonId={season._id} />
                </Section>
              )}
            </div>
          </div>
        </div>
      )}
    </Page>
  );
}

import { Camera, Medal } from "lucide-react";
import { api } from "@convex/_generated/api";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Skeleton } from "@/components/ui/misc";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";
import { AllPro, ProBowl } from "./HonorViews";
import { SeasonAwards } from "./SeasonAwards";
import { TeamAwards } from "./TeamAwards";
import type { CountedAward, SeasonAward } from "./types";
import { WeeklyAwards } from "./WeeklyAwards";
import { useQuery } from "@/lib/convex/useQuery";

type View = "weekly" | "season" | "allpro" | "probowl" | "team";

const VIEWS: {
  value: View;
  label: string;
  has: (a: SeasonAward) => boolean;
  target: "weekly_awards" | "yearly_awards";
}[] = [
  { value: "weekly", label: "Weekly", has: (a) => a.weekKey !== undefined, target: "weekly_awards" },
  {
    value: "season",
    label: "Season",
    has: (a) => !a.weekKey && a.scope !== "team" && !["AllPro1", "AllPro2", "ProBowl"].includes(a.type),
    target: "yearly_awards",
  },
  {
    value: "allpro",
    label: "All-Pro",
    has: (a) => a.type === "AllPro1" || a.type === "AllPro2",
    target: "yearly_awards",
  },
  { value: "probowl", label: "Pro Bowl", has: (a) => a.type === "ProBowl", target: "yearly_awards" },
  { value: "team", label: "Team", has: (a) => a.scope === "team", target: "yearly_awards" },
];

/** Season awards with a winner: stored, or counted from the stats for an award not assigned yet. */
function seasonCount(awards: SeasonAward[], counted: CountedAward[] | undefined) {
  const stored = new Set(awards.filter(VIEWS[1]!.has).map((a) => a.type));
  const fromStats = (counted ?? []).filter((c) => !stored.has(c.type) && c.contenders.length > 0);
  return stored.size + fromStats.length;
}

/**
 * Awards (FEATURES.md 5.8): players of the week, the season's awards (Madden's and those counted
 * from the stats), All-Pro teams, Pro Bowl rosters and the owner's own team awards, with
 * user-team winners highlighted.
 */
export function AwardsScreen() {
  const { season } = useSeason();
  const capture = useCapture();
  const [view, setView] = useLocalStorage<View>("ft.awards-view", "weekly");
  const awards = useQuery(api.awards.awards.bySeason, season ? { seasonId: season._id } : "skip");
  const counted = useQuery(api.awards.counted.bySeason, season ? { seasonId: season._id } : "skip");
  const current = VIEWS.find((v) => v.value === view) ?? VIEWS[0]!;
  const shown = awards?.filter(current.has) ?? [];
  // Team awards have their own form; every league award can be typed in like its screenshot.
  const addAward =
    season && view !== "team" ? (
      <ManualEntryLink target={current.target} seasonId={season._id} label="Add award" />
    ) : undefined;

  return (
    <Page title="Awards" eyebrow={season ? `${season.year} season` : undefined} season actions={addAward}>
      <div className="@container space-y-5">
        <Segmented
          aria-label="View"
          value={view}
          onChange={setView}
          options={VIEWS.map((v) => ({
            value: v.value,
            label: v.label,
            count:
              v.value === "season" && awards ? seasonCount(awards, counted) : awards?.filter(v.has).length,
          }))}
          className="max-w-full scrollbar-none overflow-x-auto"
        />
        {awards === undefined || !season ? (
          <Skeleton className="h-64 rounded-xl" />
        ) : view === "team" ? (
          <TeamAwards seasonId={season._id} awards={awards} />
        ) : view === "season" ? (
          <SeasonAwards seasonId={season._id} awards={shown} counted={counted} />
        ) : shown.length === 0 ? (
          <EmptyState
            icon={Medal}
            title={`No ${current.label.toLowerCase()} awards for ${season.year}`}
            description="Capture the awards screens or type them in, and they fill in here."
            action={
              <Button variant="primary" onClick={() => capture.open({ targetKey: current.target })}>
                <Camera /> Capture awards
              </Button>
            }
          />
        ) : view === "weekly" ? (
          <WeeklyAwards awards={shown} />
        ) : view === "allpro" ? (
          <AllPro awards={shown} />
        ) : (
          <ProBowl awards={shown} />
        )}
      </div>
    </Page>
  );
}

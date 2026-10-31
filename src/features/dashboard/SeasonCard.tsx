import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { BookOpen, CalendarPlus, Flag } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { PLAYOFF_RESULT_LABELS } from "@shared/domain";
import { nextSeasonAction, SEASON_STATUS_LABELS } from "@shared/seasons/lifecycle";
import { franchiseSeasons } from "@shared/seasons/reports";
import { formatRecord } from "@shared/stats";
import { currentSeason, type ActiveFranchise } from "@/app/franchise";
import { useSeason } from "@/app/season";
import { StaffLine } from "@/components/team/StaffLine";
import { Button } from "@/components/ui/button";
import { Dialog, DialogClose, DialogContent } from "@/components/ui/dialog";
import { Badge } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

const HINT = {
  upcoming: "Capture the first regular-season game to start it.",
  regular: "Mark the Super Bowl week done once your season is over.",
  postseason: "A captured Super Bowl closes the season; otherwise mark it done when the league's is played.",
  complete: "Start the next season when you reach the offseason.",
} as const;

/**
 * The season being played (FEATURES.md 4.1): status, record, staff, and the next lifecycle step,
 * either finishing it after the Super Bowl week or advancing to the next year.
 */
export function SeasonCard({ active }: { active: ActiveFranchise }) {
  const own = franchiseSeasons(active.seasons, active.franchise.startYear);
  const season = currentSeason(own);
  const finish = useMutation(api.seasons.lifecycle.finish);
  const advance = useMutation(api.seasons.lifecycle.advance);
  const { setYear } = useSeason();
  const [confirming, setConfirming] = useState(false);
  const [starting, setStarting] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const action = season
    ? nextSeasonAction(
        season.status,
        own.some((s) => s.year === season.year + 1),
      )
    : null;
  const cap = useQuery(
    api.players.cap.bySeason,
    season && action === "advance" ? { seasonId: season._id } : "skip",
  );
  if (!season) return null;
  const result = season.userRecord?.playoffResult;
  const expiring = cap?.players.filter((p) => p.expiring).length ?? 0;

  const run = async (step: () => Promise<unknown>) => {
    setError(null);
    try {
      await step();
      setConfirming(false);
      setStarting(false);
    } catch (err) {
      setError(errorMessage(err, "That did not work. Try again."));
    }
  };

  const start = () =>
    run(async () => {
      await advance({ seasonId: season._id });
      setYear(season.year + 1);
    });

  return (
    <div className="rounded-xl border border-border bg-surface p-4">
      <div className="flex flex-wrap items-center gap-3">
        <span className="num font-display text-3xl leading-none font-bold">{season.year}</span>
        <Badge tone={season.status === "complete" ? "neutral" : "accent"}>
          {SEASON_STATUS_LABELS[season.status]}
        </Badge>
        {result && <Badge>{PLAYOFF_RESULT_LABELS[result]}</Badge>}
        <span className="num ml-auto font-display text-2xl font-bold">
          {season.userRecord ? formatRecord(season.userRecord) : "0-0"}
        </span>
      </div>
      <StaffLine staff={season.coaching} className="mt-2" />
      <div className="mt-3 flex flex-wrap items-center gap-3">
        <p className="min-w-48 flex-1 text-sm text-muted-foreground">{HINT[season.status]}</p>
        {action === "finish" && (
          <Button variant="outline" size="sm" onClick={() => setConfirming(true)}>
            <Flag /> Super Bowl week done
          </Button>
        )}
        {season.status === "complete" && (
          <Button asChild variant="outline" size="sm">
            <Link to="/history/recaps/$year" params={{ year: String(season.year) }}>
              <BookOpen /> Recap
            </Link>
          </Button>
        )}
        {action === "advance" && (
          <Button
            variant="primary"
            size="sm"
            onClick={() => (expiring > 0 ? setStarting(true) : void start())}
          >
            <CalendarPlus /> Start {season.year + 1}
          </Button>
        )}
      </div>
      {error && <p className="mt-2 text-sm text-loss">{error}</p>}
      <Dialog open={confirming} onOpenChange={setConfirming}>
        <DialogContent
          title={`Finish the ${season.year} season?`}
          description="The season is marked complete and its post-season report becomes due. A Super Bowl captured later still counts."
        >
          <div className="flex justify-end gap-2 p-5">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={() => void run(() => finish({ seasonId: season._id }))}>
              Finish season
            </Button>
          </div>
        </DialogContent>
      </Dialog>
      <Dialog open={starting} onOpenChange={setStarting}>
        <DialogContent
          title={`Start ${season.year + 1}?`}
          description={`${expiring} ${expiring === 1 ? "contract runs" : "contracts run"} out. Those players stay on the roster as Contract expired until you re-sign or release them; Transactions → Cap lists them now.`}
        >
          <div className="flex justify-end gap-2 p-5">
            <DialogClose asChild>
              <Button variant="ghost">Cancel</Button>
            </DialogClose>
            <Button variant="primary" onClick={() => void start()}>
              Start {season.year + 1}
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </div>
  );
}

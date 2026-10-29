import { useMutation } from "convex/react";
import { BookCheck, CalendarRange, ScanText } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { REGULAR_WEEKS, weekLabel, type WeekKey } from "@shared/domain";
import { awardWeeks, weeklyGaps } from "@shared/awards/groups";
import { useSeason } from "@/app/season";
import { Page } from "@/components/layout/Page";
import { ImageViewer } from "@/components/media/ImageViewer";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import { batchActions, fillWeeks, orderBatch, weekStates } from "./batch";
import { BatchDropZone } from "./BatchDropZone";
import { BatchSetCard, type BatchSet } from "./BatchSetCard";
import { useBatchUpload } from "./useBatchUpload";
import { WeekStrip } from "./WeekStrip";

const grid = "grid gap-3 @tablet:grid-cols-2 @desktop:grid-cols-3";

/**
 * Weekly awards in bulk (FEATURES.md 5.11): every week's players-of-the-week screen uploaded at
 * once, matched to its week here, read together, and committed together when the model read
 * them cleanly. A screen that needs a look opens in the usual review.
 */
export function WeeklyAwardsBatchScreen() {
  const { season } = useSeason();
  const seasonId = season?._id;
  const sets = useQuery(api.ingestion.weeklyAwards.batch, seasonId ? { seasonId } : "skip");
  const awards = useQuery(api.awards.awards.bySeason, seasonId ? { seasonId } : "skip");
  const setWeek = useMutation(api.ingestion.weeklyAwards.setWeek);
  const readAll = useMutation(api.ingestion.weeklyAwards.readAll);
  const commitReady = useMutation(api.ingestion.weeklyAwards.commitReady);
  const remove = useMutation(api.ingestion.uploads.remove);
  const { upload, progress } = useBatchUpload(seasonId);
  const [viewing, setViewing] = useState<BatchSet | null>(null);
  const [message, setMessage] = useState<string | null>(null);

  const ordered = orderBatch(sets ?? []);
  const stored = awardWeeks(awards ?? []);
  const gaps = new Set(weeklyGaps(awards ?? []).map((g) => g.week));
  const complete = REGULAR_WEEKS.filter((w) => !gaps.has(w));
  const states = weekStates(ordered, stored);
  const { toRead, toCommit } = batchActions(ordered);
  const open = ordered.filter((s) => s.status !== "committed");
  const unmatched = open.filter((s) => !s.weekKey);
  const duplicates = Object.entries(states).filter(([, s]) => s === "duplicate");

  const run = async (action: () => Promise<string>) => {
    setMessage(null);
    try {
      setMessage(await action());
    } catch (err) {
      setMessage(errorMessage(err, "Something went wrong. Try again."));
    }
  };
  const keys = (list: readonly BatchSet[]) => list.map((s) => s.setKey);

  return (
    <Page
      title="Weekly awards"
      eyebrow={season ? `${season.year} season` : undefined}
      season
      back={{ to: "/awards", label: "Awards" }}
    >
      <div className="@container space-y-5">
        <WeekStrip states={states} />
        <BatchDropZone
          progress={progress}
          onFiles={(files) => void run(async () => (await upload(files), `${files.length} uploaded`))}
        />
        {sets === undefined ? (
          <div className={grid}>
            {Array.from({ length: 3 }, (_, i) => (
              <Skeleton key={i} className="aspect-video rounded-xl" />
            ))}
          </div>
        ) : ordered.length > 0 ? (
          <>
            <div className="flex flex-wrap items-center gap-2">
              {unmatched.length > 0 && (
                <Button
                  onClick={() =>
                    void run(async () => {
                      const fills = fillWeeks(ordered, complete);
                      for (const f of fills) await setWeek(f);
                      return `${fills.length} matched to weeks in upload order`;
                    })
                  }
                >
                  <CalendarRange /> Fill weeks in order
                </Button>
              )}
              {open.length > 0 && (
                <>
                  <Button
                    variant="primary"
                    disabled={toRead.length === 0}
                    onClick={() =>
                      void run(async () => `Reading ${await readAll({ setKeys: keys(toRead) })} screenshots`)
                    }
                  >
                    <ScanText /> Read {toRead.length || ""}
                  </Button>
                  <Button
                    variant={toCommit.length > 0 ? "primary" : "secondary"}
                    disabled={toCommit.length === 0}
                    onClick={() =>
                      void run(
                        async () => `${await commitReady({ setKeys: keys(toCommit) })} weeks committed`,
                      )
                    }
                  >
                    <BookCheck /> Commit {toCommit.length || ""} ready
                  </Button>
                </>
              )}
              {message && <span className="text-sm text-muted-foreground">{message}</span>}
            </div>
            {duplicates.length > 0 && (
              <p className="text-sm text-warn">
                {duplicates.map(([w]) => weekLabel(w as WeekKey)).join(", ")}: two screenshots claim the same
                week.
              </p>
            )}
            <ul className={grid} aria-label="Weekly awards screenshots">
              {ordered.map((set) => (
                <li key={set.setKey}>
                  <BatchSetCard
                    set={set}
                    states={states}
                    onOpen={() => setViewing(set)}
                    onWeek={(weekKey) =>
                      void run(async () => (await setWeek({ setKey: set.setKey, weekKey }), ""))
                    }
                    onRemove={() =>
                      void run(async () => (await remove({ setKeys: [set.setKey] }), "Removed"))
                    }
                  />
                </li>
              ))}
            </ul>
          </>
        ) : null}
      </div>
      <BottomSheet
        open={viewing !== null}
        onOpenChange={(o) => !o && setViewing(null)}
        title={viewing?.weekKey ? weekLabel(viewing.weekKey, "long") : "Screenshot"}
      >
        {viewing && (
          <ImageViewer images={[{ id: viewing.setKey, src: viewing.imageUrl, alt: "Weekly awards" }]} />
        )}
      </BottomSheet>
    </Page>
  );
}

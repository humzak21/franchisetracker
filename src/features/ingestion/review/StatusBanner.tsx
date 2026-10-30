import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { CircleCheck, CircleX, LoaderCircle, Replace, RotateCcw, Square, Tag } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { useNow } from "@/lib/hooks/useNow";
import { formatElapsed } from "@/lib/time";
import { TagSheet } from "../inbox/TagSheet";
import { RerunSheet } from "./RerunSheet";

type Review = FunctionReturnType<typeof api.ingestion.review.get>;

/** A read past this is probably stuck, so the banner says so and points at Stop and Restart. */
const SLOW_READ_MS = 3 * 60_000;

function Banner({
  tone,
  icon,
  children,
  action,
}: {
  tone: "info" | "warn" | "loss" | "win";
  icon: ReactNode;
  children: ReactNode;
  action?: ReactNode;
}) {
  const tones = {
    info: "border-border bg-surface",
    warn: "border-warn/40 bg-warn/10",
    loss: "border-loss/40 bg-loss/10",
    win: "border-win/40 bg-win/10",
  };
  return (
    <div
      role="status"
      className={cn("flex flex-wrap items-center gap-3 rounded-xl border px-4 py-3", tones[tone])}
    >
      <span className="shrink-0 [&_svg]:size-5">{icon}</span>
      <div className="min-w-0 flex-1 text-sm">{children}</div>
      {action}
    </div>
  );
}

/** Where the set stands: reading, failed, untagged, committed, or about to replace an earlier commit. */
export function StatusBanner({ data }: { data: Review }) {
  const extract = useMutation(api.ingestion.uploads.extract);
  const stop = useMutation(api.ingestion.uploads.stop);
  const [tagging, setTagging] = useState(false);
  const [rerun, setRerun] = useState(false);
  const { status, game } = data;
  const now = useNow(1000, status === "extracting");

  if (status === "extracting") {
    const started = data.extractionStartedAt;
    const slow = started !== null && now - started > SLOW_READ_MS;
    return (
      <>
        <Banner
          tone={slow ? "warn" : "info"}
          icon={<LoaderCircle className="animate-spin text-primary" />}
          action={
            <div className="flex flex-wrap gap-2">
              <Button size="sm" onClick={() => void stop({ setKeys: [data.setKey] })}>
                <Square /> Stop
              </Button>
              <Button size="sm" onClick={() => void extract({ setKey: data.setKey })}>
                <RotateCcw /> Restart
              </Button>
              <Button size="sm" variant="ghost" onClick={() => setRerun(true)}>
                Other model
              </Button>
            </div>
          }
        >
          Reading {data.images.length} screenshot{data.images.length === 1 ? "" : "s"}
          {started !== null && <span className="num"> · {formatElapsed(started, now)}</span>}.{" "}
          {slow
            ? "This is taking longer than usual. Stop it, or restart with the same or another model."
            : "This takes a few seconds per screen."}
        </Banner>
        <RerunSheet setKey={data.setKey} open={rerun} onOpenChange={setRerun} />
      </>
    );
  }
  if (status === "failed") {
    return (
      <>
        <Banner
          tone="loss"
          icon={<CircleX className="text-loss" />}
          action={
            <div className="flex gap-2">
              <Button size="sm" variant="primary" onClick={() => void extract({ setKey: data.setKey })}>
                Try again
              </Button>
              <Button size="sm" onClick={() => setRerun(true)}>
                Other model
              </Button>
            </div>
          }
        >
          <span className="font-medium">Extraction failed.</span> {data.error}
        </Banner>
        <RerunSheet setKey={data.setKey} open={rerun} onOpenChange={setRerun} />
      </>
    );
  }
  if (status === "queued") {
    return (
      <>
        <Banner
          tone="warn"
          icon={<Tag className="text-warn" />}
          action={
            <Button size="sm" variant="primary" onClick={() => setTagging(true)}>
              Tag
            </Button>
          }
        >
          Say what these screenshots are and which week they belong to, and they will be read.
        </Banner>
        {tagging && (
          <TagSheet
            setKeys={[data.setKey]}
            images={data.images.length}
            defaults={{ seasonId: data.season?._id ?? null, weekKey: data.weekKey }}
            open={tagging}
            onOpenChange={setTagging}
            onDone={() => setTagging(false)}
          />
        )}
      </>
    );
  }
  const isRows = data.extraction !== null && "rows" in data.extraction.draft;
  if (status === "committed" && isRows) {
    return (
      <Banner tone="win" icon={<CircleCheck className="text-win" />}>
        Committed. The accepted rows are saved; rows left unaccepted were not.
      </Banner>
    );
  }
  if (status === "committed" && game) {
    return (
      <Banner
        tone="win"
        icon={<CircleCheck className="text-win" />}
        action={
          <Button asChild size="sm">
            <Link to="/games/$gameId" params={{ gameId: game._id }}>
              Open the game
            </Link>
          </Button>
        }
      >
        Committed. The game, box score and player totals are up to date.
      </Banner>
    );
  }
  if (status === "rejected") {
    return (
      <Banner tone="info" icon={<CircleX className="text-muted-foreground" />}>
        Rejected. Nothing from these screenshots was written.
      </Banner>
    );
  }
  const replaces =
    data.extraction?.draft.target === "game_log"
      ? game?.hasBoxScore || game?.hasTeamStats
      : data.extraction?.draft.target === "game_box_score"
        ? game?.hasBoxScore
        : game?.hasTeamStats;
  if (game?.hasScoringPlays && data.extraction?.draft.target === "scoring_plays") {
    return (
      <Banner tone="warn" icon={<Replace className="text-warn" />}>
        This game already has a scoring summary. Committing replaces it.
      </Banner>
    );
  }
  if (game && replaces && !isRows) {
    return (
      <Banner tone="warn" icon={<Replace className="text-warn" />}>
        This game already has{" "}
        {data.extraction?.draft.target === "game_log"
          ? "game stats"
          : data.extraction?.draft.target === "game_box_score"
            ? "a box score"
            : "team stats"}
        {game.opponentAbbr ? ` against ${game.opponentAbbr}` : ""}. Committing replaces the stats included in
        this upload.
      </Banner>
    );
  }
  return null;
}

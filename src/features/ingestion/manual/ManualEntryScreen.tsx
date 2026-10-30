import { useMutation } from "convex/react";
import { Link } from "@tanstack/react-router";
import { CircleCheck, FileX, Replace } from "lucide-react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel } from "@shared/domain";
import { INGESTION_TARGETS } from "@shared/ingestion/targets";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { DraftEditor } from "../review/DraftEditor";
import { ReviewDraftProvider, type ReviewDraft } from "../review/reviewDraft";
import { useRowGame } from "../review/useRowGame";
import { ManualActions } from "./ManualActions";

const noteClass =
  "flex items-center gap-3 rounded-xl border px-4 py-3 text-sm [&_svg]:size-5 [&_svg]:shrink-0";

/**
 * Manual entry, step two: the target's draft in the review editors, with nothing read from a
 * screenshot. Edits are saved as they go; commit writes it like a reviewed extraction.
 */
export function ManualEntryScreen({ draftId }: { draftId: Id<"manualDrafts"> }) {
  const entry = useQuery(api.ingestion.manual.get, { draftId });
  const saveDraft = useMutation(api.ingestion.manualCommit.saveDraft);
  const save = useCallback((draft: ReviewDraft) => saveDraft({ draftId, draft }), [saveDraft, draftId]);
  const game = useRowGame(entry?.targetKey, entry?.game?._id);
  const back = { to: "/inbox", label: "Inbox" };

  if (entry === undefined) {
    return (
      <Page title="Enter manually" back={back}>
        <Skeleton className="mx-auto h-96 max-w-3xl rounded-xl" />
      </Page>
    );
  }

  if (entry === null) {
    return (
      <Page title="Enter manually" back={back}>
        <EmptyState
          size="page"
          icon={FileX}
          title="No such entry"
          description="It was discarded, or belongs to another franchise."
          action={
            <Link to="/inbox" className="text-sm text-primary underline">
              Back to the inbox
            </Link>
          }
        />
      </Page>
    );
  }

  const target = INGESTION_TARGETS[entry.targetKey];
  const week = entry.weekKey && target.scope !== "season" ? weekLabel(entry.weekKey, "long") : null;
  const eyebrow = ["Manual", entry.season?.year, week].filter(Boolean).join(" · ");
  const replaces =
    entry.targetKey === "game_log"
      ? entry.game?.hasBoxScore || entry.game?.hasTeamStats
      : entry.targetKey === "game_box_score"
        ? entry.game?.hasBoxScore
        : entry.targetKey === "scoring_plays"
          ? entry.game?.hasScoringPlays
          : entry.targetKey === "team_game_stats" && entry.game?.hasTeamStats;

  return (
    <Page title={target.label} eyebrow={eyebrow} back={back}>
      <div className="mx-auto max-w-3xl space-y-5">
        {entry.status === "committed" ? (
          <p role="status" className={`${noteClass} border-win/40 bg-win/10`}>
            <CircleCheck className="text-win" /> Committed. What you entered is saved.
          </p>
        ) : (
          <ReviewDraftProvider
            key={entry._id}
            onSave={save}
            initial={entry.draft}
            confidence={[]}
            extractionNotes={[]}
            game={game}
            seasonId={entry.season?._id ?? null}
          >
            {replaces && (
              <p role="status" className={`${noteClass} border-warn/40 bg-warn/10`}>
                <Replace className="text-warn" />
                This game already has{" "}
                {entry.targetKey === "game_log"
                  ? "game stats"
                  : entry.targetKey === "game_box_score"
                    ? "a box score"
                    : entry.targetKey === "scoring_plays"
                      ? "a scoring summary"
                      : "team stats"}
                {entry.game?.opponentAbbr ? ` against ${entry.game.opponentAbbr}` : ""}. Committing replaces
                it.
              </p>
            )}
            <DraftEditor />
            <ManualActions draftId={entry._id} />
          </ReviewDraftProvider>
        )}
      </div>
    </Page>
  );
}

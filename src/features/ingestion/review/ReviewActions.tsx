import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Check, LoaderCircle, RotateCw, X } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { blocksCommit } from "@shared/ingestion/validate";
import { useShortcut } from "@/app/keyboard";
import { Button } from "@/components/ui/button";
import { Kbd } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { rosterSearch } from "../manual/landing";
import { RerunSheet } from "./RerunSheet";
import { useReviewDraft } from "./reviewDraft";

/** Commit, reject and re-run, pinned to the bottom of the draft so they are always a thumb away. */
export function ReviewActions({ setKey, committed }: { setKey: string; committed: boolean }) {
  const { draft, warnings, saving } = useReviewDraft();
  const commit = useMutation(api.ingestion.review.commit);
  const reject = useMutation(api.ingestion.uploads.reject);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [rerun, setRerun] = useState(false);
  const blocked = blocksCommit(warnings);
  const errors = warnings.filter((w) => w.severity === "error").length;
  const rows = "rows" in draft ? draft.rows.filter((r) => r.accepted).length : null;

  const onCommit = async () => {
    if (blocked || busy || committed) return;
    setBusy(true);
    setError(null);
    try {
      const { gameId, playerId, nextSetKey } = await commit({ setKey, draft });
      // A game, a card or a roster lands on what it wrote; a list moves on to the next set waiting.
      if (gameId) void navigate({ to: "/games/$gameId", params: { gameId } });
      else if (playerId) void navigate({ to: "/players/$playerId", params: { playerId } });
      else if (draft.target === "season_player_stats") void navigate({ to: "/stats/reconcile" });
      else if (draft.target === "roster_page") void navigate({ to: "/roster", search: rosterSearch(draft) });
      else if (nextSetKey) void navigate({ to: "/inbox/$setKey", params: { setKey: nextSetKey } });
      else void navigate({ to: "/inbox" });
    } catch (err) {
      setError(errorMessage(err, "Commit failed. Nothing was written."));
      setBusy(false);
    }
  };
  const onReject = async () => {
    await reject({ setKeys: [setKey] });
    void navigate({ to: "/inbox" });
  };

  useShortcut("review-commit", {
    key: "enter",
    mod: true,
    label: "Commit the review",
    handler: () => void onCommit(),
  });
  useShortcut("review-rerun", { key: "r", label: "Re-run extraction", handler: () => setRerun(true) });

  return (
    <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 sm:bottom-4">
      <div className="shadow-elevated space-y-2 rounded-2xl border border-border-strong bg-surface/95 p-2 backdrop-blur">
        {(error || blocked) && (
          <p className="px-2 text-sm text-loss">
            {error ?? `Fix ${errors} error${errors === 1 ? "" : "s"} before committing`}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={blocked || busy || committed}
            aria-keyshortcuts="Meta+Enter"
            onClick={() => void onCommit()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
            {committed
              ? "Committed"
              : rows === null
                ? "Commit"
                : `Commit ${rows} row${rows === 1 ? "" : "s"}`}
            <Kbd aria-hidden className="hidden border-white/30 bg-white/10 text-current lg:inline-flex">
              ⌘↵
            </Kbd>
          </Button>
          <Button size="lg" variant="secondary" onClick={() => setRerun(true)} aria-label="Re-run extraction">
            <RotateCw />
          </Button>
          {!committed && (
            <Button size="lg" variant="ghost" onClick={() => void onReject()} aria-label="Reject">
              <X />
            </Button>
          )}
        </div>
        <p className="px-2 text-[11px] text-subtle-foreground" aria-live="polite">
          {saving ? "Saving edits…" : "Edits are saved as you go"}
        </p>
      </div>
      <RerunSheet setKey={setKey} open={rerun} onOpenChange={setRerun} />
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { Check, LoaderCircle, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { blocksCommit } from "@shared/ingestion/validate";
import { useShortcut } from "@/app/keyboard";
import { Button } from "@/components/ui/button";
import { errorMessage } from "@/lib/errors";
import { useReviewDraft } from "../review/reviewDraft";
import { landingFor, rosterSearch } from "./landing";

/** Commit and discard for a manual entry, pinned under the draft like review's actions. */
export function ManualActions({ draftId }: { draftId: Id<"manualDrafts"> }) {
  const { draft, warnings, saving } = useReviewDraft();
  const commit = useMutation(api.ingestion.manualCommit.commit);
  const discard = useMutation(api.ingestion.manualCommit.discard);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [confirmDiscard, setConfirmDiscard] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const blocked = blocksCommit(warnings);
  const errors = warnings.filter((w) => w.severity === "error");
  const rows = "rows" in draft ? draft.rows.filter((r) => r.accepted).length : null;

  const onCommit = async () => {
    if (blocked || busy) return;
    setBusy(true);
    setError(null);
    try {
      const { gameId, playerId } = await commit({ draftId, draft });
      if (gameId) void navigate({ to: "/games/$gameId", params: { gameId } });
      else if (playerId) void navigate({ to: "/players/$playerId", params: { playerId } });
      else if (draft.target === "roster_page") void navigate({ to: "/roster", search: rosterSearch(draft) });
      else void navigate({ to: landingFor(draft.target) });
    } catch (err) {
      setError(errorMessage(err, "Commit failed. Nothing was written."));
      setBusy(false);
    }
  };
  const onDiscard = async () => {
    if (!confirmDiscard) return setConfirmDiscard(true);
    await discard({ draftId });
    void navigate({ to: "/inbox" });
  };

  useShortcut("manual-commit", {
    key: "enter",
    mod: true,
    label: "Commit the entry",
    handler: () => void onCommit(),
  });

  return (
    <div className="sticky bottom-[calc(4.25rem+env(safe-area-inset-bottom))] z-20 sm:bottom-4">
      <div className="shadow-elevated space-y-2 rounded-2xl border border-border-strong bg-surface/95 p-2 backdrop-blur">
        {(error || blocked) && (
          <p className="px-2 text-sm text-loss">
            {error ??
              (errors.length === 1 ? errors[0]?.message : `Fix ${errors.length} errors before committing`)}
          </p>
        )}
        <div className="flex items-center gap-2">
          <Button
            variant="primary"
            size="lg"
            className="flex-1"
            disabled={blocked || busy}
            aria-keyshortcuts="Meta+Enter"
            onClick={() => void onCommit()}
          >
            {busy ? <LoaderCircle className="animate-spin" /> : <Check />}
            {rows === null ? "Commit" : `Commit ${rows} row${rows === 1 ? "" : "s"}`}
          </Button>
          <Button
            size="lg"
            variant={confirmDiscard ? "destructive" : "ghost"}
            aria-label={confirmDiscard ? "Confirm discard" : "Discard"}
            onClick={() => void onDiscard()}
          >
            <Trash2 /> {confirmDiscard && "Discard"}
          </Button>
        </div>
        <p className="px-2 text-[11px] text-subtle-foreground" aria-live="polite">
          {saving ? "Saving…" : "Saved as you go; finish later from the inbox"}
        </p>
      </div>
    </div>
  );
}

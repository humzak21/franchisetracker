import { useNavigate } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { LoaderCircle, PencilLine } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel } from "@shared/domain";
import { INGESTION_TARGETS } from "@shared/ingestion/targets";
import { useSeason } from "@/app/season";
import { CaptureFields, captureReady, type CaptureFieldsValue } from "@/components/forms/CaptureFields";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";
import type { ManualSearch } from "./search";

/**
 * Manual entry, step one: what is being typed in and where it goes, the same choices as tagging
 * a screenshot. Links from other screens preset them (an award's season, a game).
 */
export function ManualStartScreen({ search }: { search: ManualSearch }) {
  // Ids from the URL; the server refuses one that is not this franchise's.
  const gameId = search.gameId as Id<"games"> | undefined;
  const { seasons, season } = useSeason();
  const create = useMutation(api.ingestion.manual.create);
  const navigate = useNavigate();
  const game = useQuery(api.ingestion.manual.gameContext, gameId ? { gameId } : "skip");
  const [picked, setPicked] = useState<CaptureFieldsValue<Id<"seasons">>>({
    targetKey: search.target ?? "game_box_score",
    seasonId: (search.seasonId as Id<"seasons"> | undefined) ?? null,
    weekKey: search.weekKey ?? null,
  });
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const fields = { ...picked, seasonId: picked.seasonId ?? season?._id ?? null };
  const gameLabel = game
    ? `${game.year} · ${weekLabel(game.weekKey, "long")} ${game.userIsHome ? "vs" : "@"} ${game.opponentAbbr ?? "TBD"}`
    : undefined;
  // A link with a game waits for it, so the entry is not filed under a season by mistake.
  const waiting = gameId !== undefined && game === undefined;
  const ready = !waiting && captureReady(fields, gameLabel);

  const start = async () => {
    if (!ready || !fields.targetKey || busy) return;
    setBusy(true);
    setError(null);
    const seasonScreen = INGESTION_TARGETS[fields.targetKey].scope === "season";
    try {
      const draftId = await create({
        targetKey: fields.targetKey,
        ...(gameId
          ? { gameId }
          : {
              seasonId: fields.seasonId ?? undefined,
              weekKey: seasonScreen ? undefined : (fields.weekKey ?? undefined),
            }),
      });
      void navigate({ to: "/inbox/manual/$draftId", params: { draftId }, replace: true });
    } catch (err) {
      setError(errorMessage(err, "Could not start the entry."));
      setBusy(false);
    }
  };

  return (
    <Page title="Enter manually" back={{ to: "/inbox", label: "Inbox" }}>
      <div className="mx-auto max-w-xl">
        <Section
          variant="card"
          title="What are you entering?"
          description="Type in anything a screenshot would give you. It is checked and saved the same way."
        >
          <div className="space-y-4">
            <CaptureFields seasons={seasons} value={fields} onChange={setPicked} game={gameLabel} />
            {error && <p className="text-sm text-loss">{error}</p>}
            <Button
              variant="primary"
              size="lg"
              className="w-full"
              disabled={!ready || busy}
              onClick={() => void start()}
            >
              {busy ? <LoaderCircle className="animate-spin" /> : <PencilLine />} Start entering
            </Button>
          </div>
        </Section>
      </div>
    </Page>
  );
}

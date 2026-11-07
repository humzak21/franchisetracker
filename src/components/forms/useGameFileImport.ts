import { useNavigate } from "@tanstack/react-router";
import { useAction } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { gameFileFromText, gameFileLabel } from "@shared/ingestion/gameFile";
import { errorMessage } from "@/lib/errors";

/** What became of one file: filed for review under an entry, or why not. */
export type GameFileOutcome =
  | { file: string; ok: true; label: string; draftId: Id<"manualDrafts"> }
  | { file: string; ok: false; error: string };

/**
 * Files exported game logs for review, one after another. A single file opens its review
 * straight away; several leave a list of what was filed and what was refused.
 */
export function useGameFileImport(gameId?: Id<"games">) {
  const importFile = useAction(api.ingestion.gameFile.importFile);
  const navigate = useNavigate();
  const [busy, setBusy] = useState(false);
  const [outcomes, setOutcomes] = useState<GameFileOutcome[] | null>(null);

  const importOne = async (file: File): Promise<GameFileOutcome> => {
    const read = gameFileFromText<Id<"players">>(await file.text());
    if (!read.ok) return { file: file.name, ok: false, error: read.error };
    try {
      const { year, weekKey, draft } = read;
      const filed = await importFile({ year, weekKey, draft, gameId });
      return filed.ok
        ? { file: file.name, ok: true, label: gameFileLabel(read), draftId: filed.draftId }
        : { file: file.name, ok: false, error: filed.error };
    } catch (error) {
      return { file: file.name, ok: false, error: errorMessage(error, "Could not file this game") };
    }
  };

  const run = async (files: readonly File[]) => {
    if (files.length === 0) return;
    setBusy(true);
    const done: GameFileOutcome[] = [];
    for (const file of files) done.push(await importOne(file));
    setBusy(false);
    const [only] = done;
    if (done.length === 1 && only?.ok) {
      void navigate({ to: "/inbox/manual/$draftId", params: { draftId: only.draftId } });
    } else {
      setOutcomes(done);
    }
  };

  return { busy, outcomes, run, dismiss: () => setOutcomes(null) };
}

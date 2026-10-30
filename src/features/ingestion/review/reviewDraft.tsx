import {
  createContext,
  useCallback,
  useContext,
  useEffect,
  useMemo,
  useRef,
  useState,
  type ReactNode,
} from "react";
import type { Id } from "@convex/_generated/dataModel";
import { deriveDraft } from "@shared/ingestion/normalize";
import { gameLogContext } from "@shared/ingestion/rows/gameLogPlays";
import { rowScorerMatch } from "@shared/ingestion/rows/scoringSpec";
import type { DraftRow, RowGameContext } from "@shared/ingestion/rows/types";
import { isRowDraft, rowTarget, validateDraft } from "@shared/ingestion/targets";
import type { Draft, DraftWarning, FieldConfidence, PlayerMatch } from "@shared/ingestion/types";
import { checkBelow, getAt, setAt } from "./draftEdit";
import type { FieldFlag } from "./NumberField";

export type ReviewDraft = Draft<Id<"players">>;

type ReviewDraftState = {
  draft: ReviewDraft;
  set: (path: string, value: unknown) => void;
  update: (next: (draft: ReviewDraft) => ReviewDraft) => void;
  /** Live validation of the current draft plus notes from extraction that still apply. */
  warnings: DraftWarning[];
  confidence: readonly FieldConfidence[];
  flag: (path: string) => FieldFlag;
  /** A row or line's match: what reading found, or the box score's candidates for a nameless play. */
  matchOf: (base: string) => PlayerMatch<Id<"players">> | null;
  saving: boolean;
};

const ReviewDraftContext = createContext<ReviewDraftState | null>(null);

/** Edits stay local for responsiveness and are saved shortly after typing stops. */
const SAVE_DELAY_MS = 800;

export function ReviewDraftProvider({
  onSave,
  initial,
  confidence,
  extractionNotes,
  game,
  children,
}: {
  /** Where edits are saved: the extraction under review, or a manual entry. */
  onSave: (draft: ReviewDraft) => Promise<unknown>;
  initial: ReviewDraft;
  confidence: readonly FieldConfidence[];
  /** Warnings stored with the extraction (screens that disagreed, unknown teams). */
  extractionNotes: readonly DraftWarning[];
  /** The game a game-scoped list files under; undefined until it is known, or for other targets. */
  game?: RowGameContext<Id<"players">> | null;
  children: ReactNode;
}) {
  const [draft, setDraft] = useState(() => deriveDraft(initial));
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);
  // The latest save function, so a new one from a re-render does not restart the save timer.
  const save = useRef(onSave);
  useEffect(() => {
    save.current = onSave;
  }, [onSave]);

  useEffect(() => {
    if (!dirty.current) return;
    setSaving(true);
    const timer = setTimeout(() => {
      void save.current(draft).finally(() => setSaving(false));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft]);

  const update = useCallback((next: (d: ReviewDraft) => ReviewDraft) => {
    dirty.current = true;
    setDraft(next);
  }, []);
  const set = useCallback((path: string, value: unknown) => update((d) => setAt(d, path, value)), [update]);

  const warnings = useMemo(() => {
    const live = validateDraft(draft, game);
    const seen = new Set(live.map((w) => w.message));
    const originalValidation = new Set(validateDraft(initial, game).map((w) => w.message));
    // Live validation replaces the original validation; extraction-only notes stay until edited.
    const notes = extractionNotes.filter(
      (w) =>
        w.severity !== "error" &&
        !seen.has(w.message) &&
        !originalValidation.has(w.message) &&
        (!w.path || JSON.stringify(getAt(initial, w.path)) === JSON.stringify(getAt(draft, w.path))) &&
        w.suggestedValue === undefined,
    );
    return [...live, ...notes];
  }, [draft, extractionNotes, game, initial]);

  const flag = useCallback(
    (path: string): FieldFlag => {
      const severities = warnings.filter((w) => w.path === path).map((w) => w.severity);
      if (severities.includes("error")) return "error";
      if (severities.includes("warning")) return "warning";
      const c = confidence.find((entry) => entry.path === path);
      return c && c.value < checkBelow(draft) ? "doubt" : null;
    },
    [warnings, confidence, draft],
  );

  const matchOf = useCallback(
    (base: string) => {
      const stored = getAt(draft, `${base}.match`) as PlayerMatch<Id<"players">> | null;
      const row = getAt(draft, base) as DraftRow<Id<"players">>;
      if (draft.target === "game_log" && base.startsWith("plays.")) {
        const context = gameLogContext(draft, game);
        return (context && rowScorerMatch(row, draft.plays ?? [], context)) ?? stored;
      }
      if (!game || !isRowDraft(draft) || !rowTarget(draft.target).spec.optionalPlayer) return stored;
      return rowScorerMatch(row, draft.rows, game) ?? stored;
    },
    [draft, game],
  );

  const value = useMemo(
    () => ({ draft, set, update, warnings, confidence, flag, matchOf, saving }),
    [draft, set, update, warnings, confidence, flag, matchOf, saving],
  );
  return <ReviewDraftContext.Provider value={value}>{children}</ReviewDraftContext.Provider>;
}

export function useReviewDraft(): ReviewDraftState {
  const ctx = useContext(ReviewDraftContext);
  if (!ctx) throw new Error("useReviewDraft must be used inside ReviewDraftProvider");
  return ctx;
}

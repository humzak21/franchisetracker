import { useMutation } from "convex/react";
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
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { validateDraft } from "@shared/ingestion/targets";
import type { Draft, DraftWarning, FieldConfidence } from "@shared/ingestion/types";
import { setAt } from "./draftEdit";
import type { FieldFlag } from "./NumberField";
import { CHECK_BELOW } from "./draftEdit";

export type ReviewDraft = Draft<Id<"players">>;

type ReviewDraftState = {
  draft: ReviewDraft;
  set: (path: string, value: unknown) => void;
  update: (next: (draft: ReviewDraft) => ReviewDraft) => void;
  /** Live validation of the current draft plus notes from extraction that still apply. */
  warnings: DraftWarning[];
  confidence: readonly FieldConfidence[];
  flag: (path: string) => FieldFlag;
  saving: boolean;
};

const ReviewDraftContext = createContext<ReviewDraftState | null>(null);

/** Edits stay local for responsiveness and are saved to the extraction shortly after typing stops. */
const SAVE_DELAY_MS = 800;

export function ReviewDraftProvider({
  setKey,
  initial,
  confidence,
  extractionNotes,
  children,
}: {
  setKey: string;
  initial: ReviewDraft;
  confidence: readonly FieldConfidence[];
  /** Warnings stored with the extraction (screens that disagreed, unknown teams). */
  extractionNotes: readonly DraftWarning[];
  children: ReactNode;
}) {
  const saveDraft = useMutation(api.ingestion.review.saveDraft);
  const [draft, setDraft] = useState(initial);
  const [saving, setSaving] = useState(false);
  const dirty = useRef(false);

  useEffect(() => {
    if (!dirty.current) return;
    setSaving(true);
    const timer = setTimeout(() => {
      void saveDraft({ setKey, draft }).finally(() => setSaving(false));
    }, SAVE_DELAY_MS);
    return () => clearTimeout(timer);
  }, [draft, saveDraft, setKey]);

  const update = useCallback((next: (d: ReviewDraft) => ReviewDraft) => {
    dirty.current = true;
    setDraft(next);
  }, []);
  const set = useCallback((path: string, value: unknown) => update((d) => setAt(d, path, value)), [update]);

  const warnings = useMemo(() => {
    const live = validateDraft(draft);
    const seen = new Set(live.map((w) => w.message));
    // Extraction errors (an unknown team) are re-raised by validation while they still hold.
    const notes = extractionNotes.filter((w) => w.severity !== "error" && !seen.has(w.message));
    return [...live, ...notes];
  }, [draft, extractionNotes]);

  const flag = useCallback(
    (path: string): FieldFlag => {
      const severities = warnings.filter((w) => w.path === path).map((w) => w.severity);
      if (severities.includes("error")) return "error";
      if (severities.includes("warning")) return "warning";
      const c = confidence.find((entry) => entry.path === path);
      return c && c.value < CHECK_BELOW ? "doubt" : null;
    },
    [warnings, confidence],
  );

  const value = useMemo(
    () => ({ draft, set, update, warnings, confidence, flag, saving }),
    [draft, set, update, warnings, confidence, flag, saving],
  );
  return <ReviewDraftContext.Provider value={value}>{children}</ReviewDraftContext.Provider>;
}

export function useReviewDraft(): ReviewDraftState {
  const ctx = useContext(ReviewDraftContext);
  if (!ctx) throw new Error("useReviewDraft must be used inside ReviewDraftProvider");
  return ctx;
}

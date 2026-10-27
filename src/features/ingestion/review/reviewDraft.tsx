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
import { validateDraft } from "@shared/ingestion/targets";
import type { Draft, DraftWarning, FieldConfidence } from "@shared/ingestion/types";
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
  children,
}: {
  /** Where edits are saved: the extraction under review, or a manual entry. */
  onSave: (draft: ReviewDraft) => Promise<unknown>;
  initial: ReviewDraft;
  confidence: readonly FieldConfidence[];
  /** Warnings stored with the extraction (screens that disagreed, unknown teams). */
  extractionNotes: readonly DraftWarning[];
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
    const live = validateDraft(draft);
    const seen = new Set(live.map((w) => w.message));
    const originalValidation = new Set(validateDraft(initial).map((w) => w.message));
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
  }, [draft, extractionNotes, initial]);

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

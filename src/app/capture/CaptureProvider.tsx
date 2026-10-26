import { createContext, useCallback, useContext, useEffect, useMemo, useState, type ReactNode } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { TargetKey } from "@shared/ingestion/targets";
import { imageFiles } from "@/lib/image";
import { CaptureSheet } from "./CaptureSheet";
import { captureQueue, useUploader } from "./useUploader";

/** What a capture is pre-tagged with, e.g. from a game's "Import screenshot" button. */
export type CapturePreset = {
  targetKey?: TargetKey;
  gameId?: Id<"games">;
  /** Shown in place of the season and week pickers when `gameId` is set: "W3 vs Steelers". */
  gameLabel?: string;
};

type CaptureState = {
  open: (preset?: CapturePreset) => void;
  /** Captures taken offline that have not reached the inbox yet. */
  queued: number;
};

const CaptureContext = createContext<CaptureState | null>(null);

/**
 * Capture from anywhere (FEATURES.md 5.11): the capture sheet, plus paste or drop of images
 * anywhere in the app on the Mac, and the offline queue that flushes when the device is back online.
 */
export function CaptureProvider({ children }: { children: ReactNode }) {
  const [sheet, setSheet] = useState<{ preset: CapturePreset; files: File[] } | null>(null);
  const [queued, setQueued] = useState(0);
  const { flush } = useUploader();

  const open = useCallback((preset: CapturePreset = {}) => setSheet({ preset, files: [] }), []);

  /** Sends what is queued when online and reports how many captures are still waiting. */
  const pending = useCallback(async (): Promise<number> => {
    try {
      return navigator.onLine ? await flush() : (await captureQueue.list()).length;
    } catch {
      // IndexedDB unavailable (private mode): nothing can be queued, so nothing is waiting.
      return 0;
    }
  }, [flush]);
  const refreshQueue = useCallback(() => void pending().then(setQueued), [pending]);

  useEffect(() => {
    pending().then(setQueued, () => setQueued(0));
    window.addEventListener("online", refreshQueue);
    return () => window.removeEventListener("online", refreshQueue);
  }, [pending, refreshQueue]);

  useEffect(() => {
    const take = (files: File[], event: Event) => {
      if (files.length === 0) return;
      event.preventDefault();
      setSheet((current) => ({
        preset: current?.preset ?? {},
        files: [...(current?.files ?? []), ...files],
      }));
    };
    const onPaste = (e: ClipboardEvent) => take(imageFiles(e.clipboardData?.items), e);
    const onDrop = (e: DragEvent) => take(imageFiles(e.dataTransfer?.files), e);
    const onDragOver = (e: DragEvent) => {
      if (e.dataTransfer?.types.includes("Files")) e.preventDefault();
    };
    window.addEventListener("paste", onPaste);
    window.addEventListener("drop", onDrop);
    window.addEventListener("dragover", onDragOver);
    return () => {
      window.removeEventListener("paste", onPaste);
      window.removeEventListener("drop", onDrop);
      window.removeEventListener("dragover", onDragOver);
    };
  }, []);

  const value = useMemo(() => ({ open, queued }), [open, queued]);
  return (
    <CaptureContext.Provider value={value}>
      {children}
      <CaptureSheet
        open={sheet !== null}
        preset={sheet?.preset ?? {}}
        initialFiles={sheet?.files ?? []}
        onClose={() => setSheet(null)}
        onQueued={refreshQueue}
      />
    </CaptureContext.Provider>
  );
}

export function useCapture(): CaptureState {
  const ctx = useContext(CaptureContext);
  if (!ctx) throw new Error("useCapture must be used inside CaptureProvider");
  return ctx;
}

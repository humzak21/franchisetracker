import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WeekKey } from "@shared/domain";
import { MAX_IMAGE_BYTES, TOO_LARGE } from "@shared/ingestion/limits";
import type { TargetKey } from "@shared/ingestion/targets";
import { blobQueue } from "@/lib/blobQueue";
import { prepareImage } from "@/lib/image";
import { useReportError } from "../errors/useReportError";

export type UploadContext = {
  targetKey?: TargetKey;
  seasonId?: Id<"seasons">;
  weekKey?: WeekKey;
  gameId?: Id<"games">;
  source: "web" | "dragdrop";
};

type QueuedMeta = UploadContext & { sizes: { width: number; height: number }[] | undefined };

/** Captures waiting for a connection; shared by every tab of the installed app. */
export const captureQueue = blobQueue<QueuedMeta>("ft-captures");

/** Refusals from the server before a queued capture is given up on. */
const MAX_REFUSALS = 3;
/** The flush in progress, shared so overlapping triggers (online, focus, a new capture) send once. */
let flushing: Promise<number> | null = null;

export type UploadOutcome = { kind: "uploaded"; setKeys: string[] } | { kind: "queued" };

/**
 * Uploads screenshots into the inbox. Offline, or when the upload fails on the network, they
 * are queued on the device and sent by `flush` once the connection returns.
 */
export function useUploader() {
  const generateUploadUrl = useMutation(api.ingestion.uploads.generateUploadUrl);
  const create = useMutation(api.ingestion.uploads.create);
  const report = useReportError();

  const send = useCallback(
    async (blobs: Blob[], meta: QueuedMeta): Promise<string[]> => {
      const storageIds: Id<"_storage">[] = [];
      for (const blob of blobs) {
        const url = await generateUploadUrl();
        const response = await fetch(url, {
          method: "POST",
          headers: { "Content-Type": blob.type },
          body: blob,
        });
        if (!response.ok) throw new Error(`Upload failed (${response.status})`);
        const { storageId } = (await response.json()) as { storageId: Id<"_storage"> };
        storageIds.push(storageId);
      }
      const { sizes, ...context } = meta;
      return await create({ storageIds, sizes, ...context });
    },
    [generateUploadUrl, create],
  );

  const upload = useCallback(
    async (files: Blob[], context: UploadContext): Promise<UploadOutcome> => {
      const prepared = await Promise.all(files.map(prepareImage));
      const blobs = prepared.map((p) => p.blob);
      // Refused here rather than by the server, which cannot delete a file it has already stored.
      if (blobs.some((b) => b.size > MAX_IMAGE_BYTES)) throw new ConvexError({ message: TOO_LARGE });
      const sizes = prepared.every((p) => p.width && p.height)
        ? prepared.map((p) => ({ width: p.width ?? 0, height: p.height ?? 0 }))
        : undefined;
      const meta = { ...context, sizes };
      if (!navigator.onLine) {
        await captureQueue.add(blobs, meta);
        return { kind: "queued" };
      }
      try {
        return { kind: "uploaded", setKeys: await send(blobs, meta) };
      } catch (error) {
        // A dropped connection mid-upload queues the capture; a refusal from the server does not.
        if (!(error instanceof TypeError)) throw error;
        await captureQueue.add(blobs, meta);
        return { kind: "queued" };
      }
    },
    [send],
  );

  /**
   * Sends queued captures oldest first; returns how many are still waiting. One flush runs at a
   * time (a second caller shares it), so nothing is sent twice. A dropped connection stops the
   * flush for a later try; a capture the server refuses is skipped so it never blocks the rest,
   * and dropped after a few refusals with the reason sent to Settings → Errors.
   */
  const flush = useCallback((): Promise<number> => {
    flushing ??= (async () => {
      const items = (await captureQueue.list()).sort((a, b) => a.createdAt - b.createdAt);
      let left = items.length;
      for (const item of items) {
        try {
          await send(item.blobs, item.meta);
          await captureQueue.remove(item.id);
          left--;
        } catch (error) {
          if (error instanceof TypeError) break;
          const attempts = (item.attempts ?? 0) + 1;
          if (attempts >= MAX_REFUSALS) {
            await captureQueue.remove(item.id);
            left--;
            report(error, "rejection");
          } else {
            await captureQueue.update({ ...item, attempts });
          }
        }
      }
      return left;
    })().finally(() => {
      flushing = null;
    });
    return flushing;
  }, [send, report]);

  return { upload, flush };
}

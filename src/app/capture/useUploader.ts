import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { WeekKey } from "@shared/domain";
import type { TargetKey } from "@shared/ingestion/targets";
import { blobQueue } from "@/lib/blobQueue";
import { prepareImage } from "@/lib/image";

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

export type UploadOutcome = { kind: "uploaded"; setKeys: string[] } | { kind: "queued" };

/**
 * Uploads screenshots into the inbox. Offline, or when the upload fails on the network, they
 * are queued on the device and sent by `flush` once the connection returns.
 */
export function useUploader() {
  const generateUploadUrl = useMutation(api.ingestion.uploads.generateUploadUrl);
  const create = useMutation(api.ingestion.uploads.create);

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

  /** Sends queued captures oldest first; returns how many are still waiting. */
  const flush = useCallback(async (): Promise<number> => {
    const items = (await captureQueue.list()).sort((a, b) => a.createdAt - b.createdAt);
    let left = items.length;
    for (const item of items) {
      try {
        await send(item.blobs, item.meta);
        await captureQueue.remove(item.id);
        left--;
      } catch {
        break;
      }
    }
    return left;
  }, [send]);

  return { upload, flush };
}

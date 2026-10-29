import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { MAX_IMAGE_BYTES, TOO_LARGE } from "@shared/ingestion/limits";
import { prepareImage } from "@/lib/image";
import { storeFiles } from "@/lib/storeFiles";

/** Screenshots named as taken sort into the order they were taken, which is week order. */
const byName = (a: File, b: File) => a.name.localeCompare(b.name, undefined, { numeric: true });

/** Uploads a season's weekly awards screenshots as one batch, each its own set waiting for a week. */
export function useBatchUpload(seasonId: Id<"seasons"> | undefined) {
  const uploadUrl = useMutation(api.ingestion.uploads.generateUploadUrl);
  const create = useMutation(api.ingestion.weeklyAwards.create);
  const [progress, setProgress] = useState<{ done: number; total: number } | null>(null);

  const upload = async (files: File[]) => {
    if (!seasonId || files.length === 0) return;
    const sorted = [...files].sort(byName);
    setProgress({ done: 0, total: sorted.length });
    try {
      const prepared = [];
      for (const file of sorted) {
        const image = await prepareImage(file);
        // Refused here rather than by the server, which cannot delete a file it has already stored.
        if (image.blob.size > MAX_IMAGE_BYTES) throw new Error(TOO_LARGE);
        prepared.push(image);
      }
      const storageIds: Id<"_storage">[] = [];
      for (const image of prepared) {
        storageIds.push(...(await storeFiles<Id<"_storage">>([image.blob], () => uploadUrl())));
        setProgress({ done: storageIds.length, total: sorted.length });
      }
      const sizes = prepared.every((p) => p.width && p.height)
        ? prepared.map((p) => ({ width: p.width ?? 0, height: p.height ?? 0 }))
        : undefined;
      await create({ seasonId, storageIds, sizes });
    } finally {
      setProgress(null);
    }
  };

  return { upload, progress };
}

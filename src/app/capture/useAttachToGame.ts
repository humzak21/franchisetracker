import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { TargetKey } from "@shared/ingestion/targets";
import { useUploader } from "./useUploader";

type Attach = {
  gameId: Id<"games">;
  targetKey: TargetKey;
  /** Inbox sets picked on the sheet. */
  setKeys: readonly string[];
  /** New screenshots chosen alongside them. */
  files: readonly File[];
  source: "web" | "dragdrop";
};

/**
 * Attaches inbox screenshots (and any new ones) to a game as one set of the chosen target,
 * which starts extraction. New files go up untagged first, so nothing starts extracting before
 * the sets are merged. Returns the merged set's key.
 */
export function useAttachToGame() {
  const { upload } = useUploader();
  const tag = useMutation(api.ingestion.uploads.tag);
  return useCallback(
    async ({ gameId, targetKey, setKeys, files, source }: Attach): Promise<string> => {
      if (!navigator.onLine) throw new Error("Connect to the internet to attach inbox screenshots.");
      const keys = [...setKeys];
      if (files.length > 0) {
        const outcome = await upload([...files], { source });
        if (outcome.kind === "queued") throw new Error("The connection dropped; try again.");
        keys.push(...outcome.setKeys);
      }
      await tag({ setKeys: keys, merge: true, gameId, targetKey });
      return keys[0] ?? "";
    },
    [upload, tag],
  );
}

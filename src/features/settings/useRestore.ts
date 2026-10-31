import { useConvex } from "convex/react";
import { gunzipSync, strFromU8 } from "fflate";
import { useCallback, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { parseBackup, restoreBackup } from "@shared/ops/restore";
import { errorMessage } from "@/lib/errors";

export type RestoreState =
  | { phase: "idle" }
  | { phase: "reading" }
  | { phase: "writing"; done: number; total: number }
  | { phase: "done"; franchises: string[]; rows: number }
  | { phase: "failed"; message: string };

/** Gzipped (as the app writes them) or plain JSON (unpacked by hand) both restore. */
function decode(bytes: Uint8Array): unknown {
  const text = bytes[0] === 0x1f && bytes[1] === 0x8b ? strFromU8(gunzipSync(bytes)) : strFromU8(bytes);
  try {
    return JSON.parse(text);
  } catch {
    throw new Error("That file is not a backup (not JSON)");
  }
}

/**
 * Restores a backup in the browser (FEATURES.md 5.12): reads the file, then writes it a batch at
 * a time through the owner's restore mutations as new, inactive franchises. Keep the tab open
 * until it finishes; the existing franchises are never touched, so stopping halfway leaves only
 * an incomplete copy to delete.
 */
export function useRestore() {
  const convex = useConvex();
  const [state, setState] = useState<RestoreState>({ phase: "idle" });

  const restore = useCallback(
    async (load: () => Promise<ArrayBuffer>) => {
      setState({ phase: "reading" });
      try {
        const file = parseBackup(decode(new Uint8Array(await load())));
        const label = `restored ${new Date().toISOString().slice(0, 10)}`;
        const result = await restoreBackup(
          file,
          {
            teams: () => convex.query(api.ops.restoreData.teams, {}),
            insert: (table, rows) => convex.mutation(api.ops.restoreData.insertRows, { table, rows }),
            patch: async (table, patches) => {
              await convex.mutation(api.ops.restoreData.patchRows, { table, patches });
            },
          },
          label,
          (done, total) => setState({ phase: "writing", done, total }),
        );
        await convex.mutation(api.ops.restoreData.rebuild, {
          franchiseIds: result.franchiseIds as Id<"franchises">[],
        });
        setState({ phase: "done", franchises: result.franchises, rows: result.rows });
      } catch (err) {
        setState({
          phase: "failed",
          message: errorMessage(err, err instanceof Error ? err.message : "The restore failed."),
        });
      }
    },
    [convex],
  );

  return { state, restore, reset: () => setState({ phase: "idle" }) };
}

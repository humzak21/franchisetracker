import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import { entryCellPatch } from "@shared/roster/entryCell";
import type { EditValue } from "@/components/data/DataTable";
import type { RosterRow } from "./rosterColumns";

/** Saves one roster cell: name and college on the player, everything else on the season's entry. */
export function useRosterEdit() {
  const updatePlayer = useMutation(api.players.player.update);
  const updateEntry = useMutation(api.players.roster.updateEntry);
  return useCallback(
    async (row: RosterRow, columnId: string, value: EditValue) => {
      const text = value === null ? null : String(value);
      const playerId = row.player._id;
      if (columnId === "player") return await updatePlayer({ playerId, patch: { displayName: text ?? "" } });
      if (columnId === "college") return await updatePlayer({ playerId, patch: { college: text } });
      const patch = entryCellPatch(columnId, value);
      if (patch === null) return null;
      if (!patch.ok) throw new ConvexError({ code: "invalid", message: patch.error });
      return await updateEntry({ entryId: row.entry._id, patch: patch.fields });
    },
    [updatePlayer, updateEntry],
  );
}

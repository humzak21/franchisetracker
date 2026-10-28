import { ArrowLeftRight, HeartPulse, ListPlus, PenLine } from "lucide-react";
import { useCallback } from "react";
import type { Id } from "@convex/_generated/dataModel";
import type { Position } from "@shared/domain";
import type { ActionMenuItem } from "@/components/ui/ActionMenu";
import { useFranchise } from "../franchise";
import { prefillOf } from "./forms/moveForm";
import { useMoves } from "./MovesProvider";

export type MovePlayer = {
  playerId: Id<"players">;
  name: string;
  position?: Position;
  /** The team he plays for now, when known: the side of a trade he starts on, the team a move acts on. */
  teamId?: Id<"teams">;
};

/**
 * Menu items that record a transaction for one player: a trade, a signing (only for players
 * the user team does not have), any other move, or an injury. Empty until the sheets can open.
 */
export function useMoveActions(): (player: MovePlayer) => ActionMenuItem[] {
  const { open, ready } = useMoves();
  const userTeamId = useFranchise()?.franchise.userTeamId;
  return useCallback(
    ({ playerId, name, position, teamId }: MovePlayer) => {
      if (!ready) return [];
      const prefill = prefillOf({ kind: "existing", playerId, name, position }, teamId);
      const items: ActionMenuItem[] = [
        {
          id: "trade",
          label: "Record trade",
          icon: ArrowLeftRight,
          onSelect: () => open({ kind: "trade", prefill }),
        },
      ];
      if (teamId !== userTeamId)
        items.push({
          id: "sign",
          label: "Sign as free agent",
          icon: PenLine,
          onSelect: () => open({ kind: "sign", prefill }),
        });
      items.push(
        {
          id: "other",
          label: "Other move",
          icon: ListPlus,
          onSelect: () => open({ kind: "other", prefill }),
        },
        {
          id: "injury",
          label: "Log injury",
          icon: HeartPulse,
          onSelect: () => open({ kind: "injury", prefill }),
        },
      );
      return items;
    },
    [open, ready, userTeamId],
  );
}

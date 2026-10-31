import type { Id } from "@convex/_generated/dataModel";
import type { Position, TransactionType } from "@shared/domain";
import { useFranchise } from "../franchise";
import { prefillOf } from "./forms/moveForm";
import { useMoves } from "./MovesProvider";

/** Opens the move sheet on a user-team player's contract: a re-signing, or letting them go. */
export function useContractMove() {
  const { open, ready } = useMoves();
  const teamId = useFranchise()?.franchise.userTeamId;
  const record = (
    player: { playerId: Id<"players">; name: string; position: Position },
    type: TransactionType,
  ) => open({ kind: "other", prefill: { ...prefillOf({ kind: "existing", ...player }, teamId), type } });
  return { ready, record };
}

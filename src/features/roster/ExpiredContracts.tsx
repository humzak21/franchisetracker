import { FileClock, PenLine, UserMinus } from "lucide-react";
import { useState } from "react";
import { capHit, formatMoney } from "@shared/roster/cap";
import { useContractMove } from "@/app/moves/useContractMove";
import { Notice } from "@/components/data/Notice";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Button } from "@/components/ui/button";
import type { RosterRow } from "./rosterColumns";

/** User-team players whose deal ran out at carry-over: each is re-signed or let go, as a logged move. */
export function ExpiredContracts({ rows }: { rows: readonly RosterRow[] }) {
  const { ready, record } = useContractMove();
  const [open, setOpen] = useState(false);
  if (rows.length === 0 || !ready) return null;

  const settle = (row: RosterRow, type: "resign" | "release") => {
    setOpen(false);
    record({ playerId: row.player._id, name: row.player.displayName, position: row.entry.position }, type);
  };

  return (
    <>
      <Notice icon={FileClock}>
        {rows.length} {rows.length === 1 ? "contract" : "contracts"} ran out.{" "}
        <button type="button" className="text-primary underline" onClick={() => setOpen(true)}>
          Re-sign or release
        </button>
      </Notice>
      <BottomSheet
        open={open}
        onOpenChange={setOpen}
        title="Expired contracts"
        description="Each stays on the roster until one of these is logged."
      >
        <ul className="divide-y divide-border">
          {rows.map((row) => {
            const hit = capHit(row.entry.contract);
            return (
              <li key={row.entry._id} className="flex min-h-14 flex-wrap items-center gap-2 py-2">
                <PositionBadge position={row.entry.position} />
                <span className="min-w-32 flex-1">
                  <span className="block truncate font-medium">{row.player.displayName}</span>
                  <span className="block text-xs text-muted-foreground">
                    OVR {row.entry.ovr ?? "—"}
                    {hit !== null ? ` · was ${formatMoney(hit)} a year` : ""}
                  </span>
                </span>
                <Button size="sm" variant="outline" onClick={() => settle(row, "resign")}>
                  <PenLine /> Re-sign
                </Button>
                <Button size="sm" variant="outline" onClick={() => settle(row, "release")}>
                  <UserMinus /> Release
                </Button>
              </li>
            );
          })}
        </ul>
      </BottomSheet>
    </>
  );
}

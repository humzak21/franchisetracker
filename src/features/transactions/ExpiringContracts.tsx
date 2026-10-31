import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { PenLine, UserMinus } from "lucide-react";
import type { api } from "@convex/_generated/api";
import { formatMoney } from "@shared/roster/cap";
import { useContractMove } from "@/app/moves/useContractMove";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Button } from "@/components/ui/button";

type Cap = FunctionReturnType<typeof api.players.cap.bySeason>;

/**
 * Who is up after this season, each re-signed or let go as a logged move. Letting a player go waits
 * for the season to end: during it a release would take them off the team, not end their deal.
 */
export function ExpiringContracts({ cap }: { cap: Cap }) {
  const { ready, record } = useContractMove();
  const players = cap.players.filter((p) => p.expiring);
  if (players.length === 0) return null;
  const over = cap.status === "complete";
  return (
    <Section
      title="Contract year"
      description={
        over
          ? "Anyone not settled here comes up again as Contract expired when the next season starts."
          : `Their deals run out after ${cap.year}. Letting one go opens once the season is over.`
      }
    >
      <ul className="divide-y divide-border rounded-xl border border-border bg-surface px-3">
        {players.map((p) => {
          const player = { playerId: p.playerId, name: p.displayName, position: p.position };
          return (
            <li key={p.playerId} className="flex min-h-14 flex-wrap items-center gap-2 py-2">
              <PositionBadge position={p.position} />
              <span className="min-w-32 flex-1">
                <Link
                  to="/players/$playerId"
                  params={{ playerId: p.playerId }}
                  className="block truncate font-medium hover:underline"
                >
                  {p.displayName}
                </Link>
                <span className="block text-xs text-muted-foreground">
                  OVR {p.ovr ?? "—"}
                  {p.apy !== null ? ` · ${formatMoney(p.apy)} a year` : ""}
                </span>
              </span>
              {ready && (
                <Button size="sm" variant="outline" onClick={() => record(player, "resign")}>
                  <PenLine /> Re-sign
                </Button>
              )}
              {ready && over && (
                <Button size="sm" variant="outline" onClick={() => record(player, "release")}>
                  <UserMinus /> Let go
                </Button>
              )}
            </li>
          );
        })}
      </ul>
    </Section>
  );
}

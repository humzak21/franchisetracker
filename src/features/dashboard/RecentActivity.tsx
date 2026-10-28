import { Link } from "@tanstack/react-router";
import { ArrowDownLeft, ArrowUpRight, ArrowLeftRight, Bandage } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { TRANSACTION_LABELS } from "@shared/domain";
import { timingLabel } from "@shared/transactions";
import { PositionBadge } from "@/components/player/PositionBadge";
import { Badge, Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";

function Name({ player }: { player: { playerId?: Id<"players">; name: string; position?: string } }) {
  const label = (
    <span className="inline-flex min-w-0 items-center gap-1.5">
      {player.position && <PositionBadge position={player.position} />}
      <span className="truncate">{player.name}</span>
    </span>
  );
  return player.playerId ? (
    <Link
      to="/players/$playerId"
      params={{ playerId: player.playerId }}
      className="min-w-0 hover:underline pointer-coarse:touch-target"
    >
      {label}
    </Link>
  ) : (
    label
  );
}

/** Recent transactions and injuries (FEATURES.md 5.1): the user team's latest few of each. */
export function RecentActivity({ seasonId }: { seasonId: Id<"seasons"> }) {
  const recent = useQuery(api.dashboard.activity.recent, { seasonId });
  if (recent === undefined) return <Skeleton className="h-40 rounded-xl" />;
  const { moves, injuries } = recent;

  return (
    <div className="overflow-hidden rounded-xl border border-border bg-surface">
      {moves.length === 0 && injuries.length === 0 ? (
        <p className="px-4 py-6 text-center text-sm text-muted-foreground">
          No moves or injuries logged this season.
        </p>
      ) : (
        <ul className="divide-y divide-border">
          {moves.map((m) => {
            const Icon =
              m.type === "trade" ? ArrowLeftRight : m.direction === "in" ? ArrowDownLeft : ArrowUpRight;
            return (
              <li key={m._id} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
                <Icon className="size-4 shrink-0 text-muted-foreground" />
                <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                  <Badge>{TRANSACTION_LABELS[m.type]}</Badge>
                  {m.players.slice(0, 2).map((p, i) => (
                    <Name key={`${p.name}-${i}`} player={p} />
                  ))}
                  {m.counterpart && <span className="text-muted-foreground">with {m.counterpart.abbr}</span>}
                </span>
                <span className="num shrink-0 text-xs text-subtle-foreground">
                  {timingLabel(m.phase, m.weekKey)}
                </span>
              </li>
            );
          })}
          {injuries.map((injury) => (
            <li key={injury._id} className="flex min-h-12 items-center gap-3 px-4 py-2 text-sm">
              <Bandage className="size-4 shrink-0 text-loss" />
              <span className="flex min-w-0 flex-1 flex-wrap items-center gap-x-2 gap-y-1">
                <Name player={injury.player} />
                <span className="text-muted-foreground">
                  {injury.injuryType}
                  {injury.lengthLabel && ` · ${injury.lengthLabel}`}
                </span>
                {injury.onIr && <Badge tone="loss">IR</Badge>}
              </span>
              <span className="num shrink-0 text-xs text-subtle-foreground">
                {timingLabel(undefined, injury.weekKey)}
              </span>
            </li>
          ))}
        </ul>
      )}
      <Link
        to="/transactions"
        className="flex min-h-11 items-center border-t border-border px-4 text-sm font-medium text-primary hover:bg-surface-2"
      >
        All transactions and injuries
      </Link>
    </div>
  );
}

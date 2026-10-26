import { useMutation } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { Check, RotateCcw, SearchX } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { GAMES_KEY } from "@shared/ingestion/reconcile";
import { formatSigned, formatStat, isStatKey, STAT_REGISTRY } from "@shared/stats";
import { PlayerChip } from "@/components/player/PlayerChip";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";

export type Difference = FunctionReturnType<typeof api.stats.reconcile.get>["differences"][number];

const statName = (stat: string) =>
  stat === GAMES_KEY ? "Games played" : isStatKey(stat) ? STAT_REGISTRY[stat].label : stat;
const show = (stat: string, value: number) =>
  stat !== GAMES_KEY && isStatKey(stat) ? formatStat(stat, value) : String(value);

/**
 * One number the screen and the logs disagree on, with the two ways to settle it: the logs are
 * right (accept the log-derived number), or a game is missing from them (flag it to capture).
 */
export function ReconcileCard({
  seasonId,
  difference: d,
}: {
  seasonId: Id<"seasons">;
  difference: Difference;
}) {
  const resolve = useMutation(api.stats.reconcile.resolve);
  const settle = (resolution: "logs" | "missing" | null) =>
    void resolve({ seasonId, playerId: d.playerId, stat: d.stat, resolution });
  const open = d.resolution === null;
  return (
    <article
      className={cn("rounded-xl border bg-surface p-3", open ? "border-warn/50" : "border-border opacity-80")}
    >
      <div className="flex items-start gap-3">
        <PlayerChip player={d.player} size="sm" caption={statName(d.stat)} className="min-w-0 flex-1" />
        {d.resolution === "logs" && <Badge tone="win">Logs accepted</Badge>}
        {d.resolution === "missing" && <Badge tone="warn">Missing game</Badge>}
      </div>
      <dl className="num mt-3 grid grid-cols-3 gap-2 text-center">
        <div className="flex flex-col-reverse rounded-lg bg-surface-2 py-1.5">
          <dt className="text-[10px] font-semibold tracking-wide text-subtle-foreground uppercase">Screen</dt>
          <dd className="font-display text-xl font-bold">{show(d.stat, d.reported)}</dd>
        </div>
        <div className="flex flex-col-reverse rounded-lg bg-surface-2 py-1.5">
          <dt className="text-[10px] font-semibold tracking-wide text-subtle-foreground uppercase">Logs</dt>
          <dd className="font-display text-xl font-bold">{show(d.stat, d.logs)}</dd>
        </div>
        <div className="flex flex-col-reverse rounded-lg bg-warn/10 py-1.5">
          <dt className="text-[10px] font-semibold tracking-wide text-subtle-foreground uppercase">Off by</dt>
          <dd className="font-display text-xl font-bold text-warn">
            {formatSigned(Number(d.delta.toFixed(1)))}
          </dd>
        </div>
      </dl>
      <div className="mt-3 flex flex-wrap gap-2">
        {open ? (
          <>
            <Button size="sm" variant="primary" onClick={() => settle("logs")}>
              <Check /> Use log number
            </Button>
            <Button size="sm" variant="outline" onClick={() => settle("missing")}>
              <SearchX /> Missing game
            </Button>
          </>
        ) : (
          <Button size="sm" variant="ghost" onClick={() => settle(null)}>
            <RotateCcw /> Reopen
          </Button>
        )}
      </div>
    </article>
  );
}

import { Link } from "@tanstack/react-router";
import { useMutation } from "convex/react";
import { ArrowDown, ArrowUp } from "lucide-react";
import { useMemo } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { depthChart, moved } from "@shared/roster/depth";
import { PlayerChip } from "@/components/player/PlayerChip";
import { PositionBadge } from "@/components/player/PositionBadge";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import type { RosterRow } from "./rosterColumns";

/**
 * The depth chart (FEATURES.md 5.3): each position in order with its OVR. A roster page sets the
 * order; the arrows fix it by hand.
 */
export function DepthChartView({ rows, team }: { rows: readonly RosterRow[]; team: TeamLike }) {
  const reorder = useMutation(api.players.depth.reorder);
  const positions = useMemo(() => depthChart(rows, (r) => r.entry), [rows]);
  const move = (ids: Id<"rosterEntries">[], id: Id<"rosterEntries">, by: -1 | 1) =>
    void reorder({ entryIds: moved(ids, id, by) });

  return (
    <div className="@container">
      <div className="grid grid-cols-1 gap-4 @tablet:grid-cols-2 @desktop:grid-cols-3">
        {positions.map(({ position, rows: atPosition }) => {
          const ids = atPosition.map((r) => r.entry._id);
          return (
            <section
              key={position}
              aria-label={`${position} depth`}
              className="rounded-xl border border-border bg-surface p-3"
            >
              <h3 className="mb-2 flex items-center gap-2 text-sm font-semibold">
                <PositionBadge position={position} />
                <span className="num text-xs font-normal text-muted-foreground">{atPosition.length}</span>
              </h3>
              <ol className="divide-y divide-border">
                {atPosition.map((r, index) => (
                  <li key={r.entry._id} className="flex items-center gap-2 py-1.5">
                    <span className="num w-5 shrink-0 text-center text-xs text-subtle-foreground">
                      {index + 1}
                    </span>
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: r.player._id }}
                      className="min-w-0 flex-1 rounded-md hover:text-primary"
                    >
                      <PlayerChip
                        size="sm"
                        showPosition={false}
                        player={{
                          displayName: r.player.displayName,
                          position: r.entry.position,
                          jersey: r.entry.jersey,
                          headshotUrl: r.headshotUrl,
                          team,
                        }}
                      />
                    </Link>
                    <Badge className="num shrink-0">{r.entry.ovr ?? "—"}</Badge>
                    {atPosition.length > 1 && (
                      <span className="flex shrink-0">
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={index === 0}
                          aria-label={`Move ${r.player.displayName} up`}
                          onClick={() => move(ids, r.entry._id, -1)}
                        >
                          <ArrowUp />
                        </Button>
                        <Button
                          size="icon"
                          variant="ghost"
                          disabled={index === atPosition.length - 1}
                          aria-label={`Move ${r.player.displayName} down`}
                          onClick={() => move(ids, r.entry._id, 1)}
                        >
                          <ArrowDown />
                        </Button>
                      </span>
                    )}
                  </li>
                ))}
              </ol>
            </section>
          );
        })}
      </div>
    </div>
  );
}

import { useNavigate } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Columns3 } from "lucide-react";
import { useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { compareStats, radarAxes, radarValues } from "@shared/players/compare";
import { STAT_REGISTRY, type StatLine } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { RadarCompare } from "@/components/data/RadarCompare";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { Segmented } from "@/components/ui/segmented";
import { seriesColors, useTheme } from "@/design/theme";
import { CompareTable } from "./CompareTable";
import { PlayerSearch } from "./PlayerSearch";

const MAX = 4;
type Split = "regular" | "postseason";

/** Compare (FEATURES.md 5.4): two to four players over the stats they share, with a radar. */
export function CompareScreen({ ids }: { ids: readonly Id<"players">[] }) {
  const navigate = useNavigate();
  const [split, setSplit] = useState<Split>("regular");
  const { resolved } = useTheme();
  const players = useQuery(api.players.compare.get, ids.length > 0 ? { playerIds: [...ids] } : "skip");
  const setIds = (next: Id<"players">[]) =>
    void navigate({ to: "/players/compare", search: { ids: next }, replace: true });

  const view = useMemo(() => {
    if (!players || players.length === 0) return null;
    const careers = players.map((p) => ({ games: p[split].games, totals: p[split].totals as StatLine }));
    const stats = compareStats(
      players.map((p) => p.position),
      careers,
    );
    const axes = players.length > 1 ? radarAxes(stats) : [];
    const values = radarValues(axes, careers);
    const colors = seriesColors(
      players.map((p) => p.team),
      resolved,
    );
    return {
      stats,
      axes: axes.map((k) => ({ key: k, label: STAT_REGISTRY[k].abbr })),
      series: players.map((p, i) => ({
        id: p.playerId,
        name: p.displayName,
        color: colors[i] ?? "var(--muted-foreground)",
        values: values[i] ?? {},
      })),
    };
  }, [players, split, resolved]);

  return (
    <Page title="Compare" eyebrow="Players" back={{ to: "/players", label: "Players" }}>
      <div className="@container space-y-6">
        {ids.length < MAX && (
          <PlayerSearch
            // A fresh search box after each add.
            key={ids.join()}
            placeholder="Add a player to compare"
            action={(hit) =>
              ids.includes(hit.playerId) ? null : (
                <Button size="sm" variant="outline" onClick={() => setIds([...ids, hit.playerId])}>
                  Add
                </Button>
              )
            }
          />
        )}
        {ids.length === 0 ? (
          <EmptyState
            icon={Columns3}
            title="Pick players to compare"
            description="Up to four, from any era: real seasons before the franchise count with the ones you play."
          />
        ) : players === undefined || !view ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <>
            {players.some((p) => p.postseason.games > 0) && (
              <Segmented
                size="sm"
                aria-label="Split"
                value={split}
                onChange={setSplit}
                options={[
                  { value: "regular", label: "Regular season" },
                  { value: "postseason", label: "Playoffs" },
                ]}
              />
            )}
            <CompareTable
              players={players}
              stats={view.stats}
              split={split}
              onRemove={(id) => setIds(ids.filter((p) => p !== id))}
            />
            {view.axes.length > 0 && (
              <Section
                title="Shape"
                description="Each spoke is a share of the best career in this group."
                variant="card"
              >
                <RadarCompare axes={view.axes} series={view.series} />
              </Section>
            )}
          </>
        )}
      </div>
    </Page>
  );
}

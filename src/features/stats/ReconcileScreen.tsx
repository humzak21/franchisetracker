import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Camera, CircleCheck, ScanSearch } from "lucide-react";
import { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { useCapture } from "@/app/capture/CaptureProvider";
import { useSeason } from "@/app/season";
import { EmptyState } from "@/components/data/EmptyState";
import { Notice } from "@/components/data/Notice";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ReconcileCard } from "./ReconcileCard";

/**
 * Reconciliation (Sprint 6): the season totals a season stats screenshot printed against the
 * totals from captured game logs. Differences are cards: accept the log number or flag a
 * missing game. Logs stay the source of truth either way.
 */
export function ReconcileScreen() {
  const { season } = useSeason();
  const capture = useCapture();
  const data = useQuery(api.stats.reconcile.get, season ? { seasonId: season._id } : "skip");
  const open = data?.differences.filter((d) => d.resolution === null) ?? [];
  const settled = data?.differences.filter((d) => d.resolution !== null) ?? [];

  return (
    <Page
      title="Reconcile"
      eyebrow={season ? `${season.year} season` : undefined}
      back={{ to: "/stats", label: "Stats" }}
      season
    >
      {data === undefined || !season ? (
        <div className="space-y-3" aria-busy="true">
          <Skeleton className="h-20 rounded-xl" />
          <Skeleton className="h-40 rounded-xl" />
        </div>
      ) : data.reportedPlayers === 0 ? (
        <EmptyState
          size="page"
          icon={ScanSearch}
          title={`Nothing to reconcile for ${season.year}`}
          description="Capture the season stats screens at the end of the season; their totals are checked against your box scores here."
          action={
            <Button variant="primary" onClick={() => capture.open({ targetKey: "season_player_stats" })}>
              <Camera /> Capture season stats
            </Button>
          }
        />
      ) : (
        <div className="space-y-6">
          <TileStrip>
            <Tile label="Players checked" value={data.reportedPlayers} />
            <Tile label="Numbers that match" value={data.matched} accent />
            <Tile label="To settle" value={open.length} />
            <Tile label="Settled" value={settled.length} />
          </TileStrip>
          {data.weeksWithoutBoxScore.length > 0 && (
            <Notice icon={Camera}>
              Results without a box score: {data.weeksWithoutBoxScore.map((w) => weekLabel(w)).join(", ")}. A
              missing game is most likely one of these.{" "}
              <Link to="/inbox" className="text-primary underline">
                Capture it
              </Link>
            </Notice>
          )}
          {open.length === 0 ? (
            <EmptyState
              icon={CircleCheck}
              title="Everything is settled"
              description="Every number on the screen matches the logs or has been settled."
            />
          ) : (
            <Section title="Differences" description="Biggest first. The logs are the source of truth.">
              <ul className="@container grid gap-3 @3xl:grid-cols-2">
                {open.map((d) => (
                  <li key={`${d.playerId}-${d.stat}`}>
                    <ReconcileCard seasonId={season._id} difference={d} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
          {settled.length > 0 && (
            <Section title="Settled">
              <ul className="@container grid gap-3 @3xl:grid-cols-2">
                {settled.map((d) => (
                  <li key={`${d.playerId}-${d.stat}`}>
                    <ReconcileCard seasonId={season._id} difference={d} />
                  </li>
                ))}
              </ul>
            </Section>
          )}
        </div>
      )}
    </Page>
  );
}

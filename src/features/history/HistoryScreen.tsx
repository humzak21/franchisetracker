import { Link } from "@tanstack/react-router";
import { Camera, ChevronRight, FileText, Landmark, ScrollText, type LucideIcon } from "lucide-react";
import { useCallback, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { isPreFranchise } from "@shared/history/nflverse";
import { byDecade, totalsOf, trophyRoom } from "@shared/history/trophies";
import { formatRecord, winPct } from "@shared/stats";
import { useCapture } from "@/app/capture/CaptureProvider";
import { Tile, TileStrip } from "@/components/data/Tile";
import { ManualEntryLink } from "@/components/forms/ManualEntryLink";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { DecadeGrid } from "./DecadeGrid";
import { EditHistory } from "./EditHistory";
import { EditSeasonSheet } from "./EditSeasonSheet";
import { TrophyRoom } from "./TrophyRoom";

const PLACES: { to: string; icon: LucideIcon; title: string; description: string }[] = [
  {
    to: "/history/reports",
    icon: FileText,
    title: "Season reports",
    description: "What you expected, what happened, what to fix",
  },
  {
    to: "/history/hall-of-fame",
    icon: Landmark,
    title: "Hall of Fame",
    description: "The jersey wall and retired numbers",
  },
  {
    to: "/history/timeline",
    icon: ScrollText,
    title: "Timeline",
    description: "Every note, move and award as one story",
  },
];

function Places() {
  return (
    <nav aria-label="History" className="grid gap-2 @tablet:grid-cols-3">
      {PLACES.map(({ to, icon: Icon, title, description }) => (
        <Link
          key={to}
          to={to}
          className="flex min-h-16 items-center gap-3 rounded-xl border border-border bg-surface px-4 py-3 transition-colors hover:bg-surface-2"
        >
          <Icon className="size-5 shrink-0 text-primary" />
          <span className="min-w-0 flex-1">
            <span className="block font-display text-lg leading-tight font-semibold tracking-wide uppercase">
              {title}
            </span>
            <span className="block truncate text-xs text-muted-foreground">{description}</span>
          </span>
          <ChevronRight className="size-4 shrink-0 text-subtle-foreground" />
        </Link>
      ))}
    </nav>
  );
}

/** Franchise history home: reports, Hall of Fame and timeline, all-time totals, the trophy room and decade grids. */
export function HistoryScreen() {
  const data = useQuery(api.history.trophies.overview, {});
  const capture = useCapture();
  const [editing, setEditing] = useState<Doc<"seasons"> | null>(null);
  const onEdit = useCallback((season: Doc<"seasons">) => setEditing(season), []);

  if (data === undefined) {
    return (
      <Page title="History">
        <div className="space-y-4">
          <Skeleton className="h-24 rounded-xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      </Page>
    );
  }

  const played = data.seasons.filter((s) => s.userRecord);
  const real = data.seasons.filter((s) => isPreFranchise(s.year, data.startYear)).length;
  const totals = totalsOf(played);
  const pct = winPct(totals);
  const room = trophyRoom(data.seasons, data.entries, data.startYear);
  const firstSeasonId = data.seasons.find((s) => s.year === data.startYear)?._id;

  return (
    <Page title="History" eyebrow={`Since ${data.seasons[0]?.year ?? data.startYear}`}>
      <div className="space-y-10">
        <Places />
        <TileStrip>
          <Tile
            label="All-time record"
            value={formatRecord(totals)}
            accent
            detail={pct === null ? "No games yet" : `${(pct * 100).toFixed(1)}% wins`}
          />
          <Tile
            label="Seasons"
            value={played.length}
            detail={
              real > 0 ? `${real} real NFL before ${data.startYear}` : `of ${data.seasons.length} tracked`
            }
          />
          <Tile label="Playoff trips" value={totals.playoffs} />
          <Tile
            label="Super Bowls"
            value={room.superBowl.length}
            detail={`${room.superBowl.filter((t) => t.source === "franchise").length} in the franchise`}
          />
        </TileStrip>

        <Section
          title="Trophy room"
          actions={<EditHistory entries={data.entries} beforeYear={data.startYear} />}
        >
          <TrophyRoom room={room} />
        </Section>

        <Section
          title="Seasons"
          description="Seasons before the real NFL import come from your team's history: a screenshot, a CSV or typed in."
          actions={
            <>
              <Button size="sm" variant="outline" onClick={() => capture.open({ targetKey: "team_history" })}>
                <Camera /> <span className="max-sm:sr-only">Capture history</span>
              </Button>
              <ManualEntryLink target="team_history" seasonId={firstSeasonId} label="Type or import" />
            </>
          }
        >
          <div className="space-y-10">
            {byDecade(data.seasons).map(({ decade, seasons, totals: decadeTotals }) => (
              <Section
                key={decade}
                title={`${decade}s`}
                description={`${formatRecord(decadeTotals)} · ${decadeTotals.playoffs} playoff trips`}
              >
                <DecadeGrid
                  seasons={seasons}
                  totals={decadeTotals}
                  startYear={data.startYear}
                  onEdit={onEdit}
                />
              </Section>
            ))}
          </div>
        </Section>
      </div>
      {editing && (
        <EditSeasonSheet
          key={editing._id}
          season={editing}
          real={isPreFranchise(editing.year, data.startYear)}
          onClose={() => setEditing(null)}
        />
      )}
    </Page>
  );
}

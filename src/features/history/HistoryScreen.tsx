import { useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import { byDecade, totalsOf, trophyRoom } from "@shared/history/trophies";
import { formatRecord, winPct } from "@shared/stats";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { DecadeGrid } from "./DecadeGrid";
import { EditHistory } from "./EditHistory";
import { TrophyRoom } from "./TrophyRoom";

/** Franchise history home: all-time totals, the trophy room and generated decade grids. */
export function HistoryScreen() {
  const data = useQuery(api.history.trophies.overview, {});

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
  const totals = totalsOf(played);
  const pct = winPct(totals);
  const room = trophyRoom(data.seasons, data.entries);

  return (
    <Page title="History" eyebrow={`Since ${data.startYear}`}>
      <div className="space-y-10">
        <TileStrip>
          <Tile
            label="All-time record"
            value={formatRecord(totals)}
            accent
            detail={pct === null ? "No games yet" : `${(pct * 100).toFixed(1)}% wins`}
          />
          <Tile label="Seasons" value={played.length} detail={`of ${data.seasons.length} tracked`} />
          <Tile label="Playoff trips" value={totals.playoffs} />
          <Tile
            label="Super Bowls"
            value={room.superBowl.length}
            detail={`${totals.titles} in the franchise`}
          />
        </TileStrip>

        <Section
          title="Trophy room"
          actions={<EditHistory entries={data.entries} beforeYear={data.startYear} />}
        >
          <TrophyRoom room={room} />
        </Section>

        {byDecade(data.seasons).map(({ decade, seasons, totals: decadeTotals }) => (
          <Section
            key={decade}
            title={`${decade}s`}
            description={`${formatRecord(decadeTotals)} · ${decadeTotals.playoffs} playoff trips`}
          >
            <DecadeGrid seasons={seasons} totals={decadeTotals} />
          </Section>
        ))}
      </div>
    </Page>
  );
}

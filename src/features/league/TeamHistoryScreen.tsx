import { Link } from "@tanstack/react-router";
import { useQuery } from "convex/react";
import { Users } from "lucide-react";
import type { FunctionReturnType } from "convex/server";
import { api } from "@convex/_generated/api";
import { PLAYOFF_RESULT_LABELS } from "@shared/domain";
import { isPreFranchise } from "@shared/history/nflverse";
import { formatOrdinal, formatRecord } from "@shared/stats";
import { DataTable, type DataColumn } from "@/components/data/DataTable";
import { EmptyState } from "@/components/data/EmptyState";
import { Tile, TileStrip } from "@/components/data/Tile";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Badge, Skeleton } from "@/components/ui/misc";
import { TeamHeadToHead } from "./TeamHeadToHead";

type History = FunctionReturnType<typeof api.league.teamHistory.get>;
type SeasonRow = History["seasons"][number];

const seasonColumns = (startYear: number): DataColumn<SeasonRow>[] => [
  {
    id: "year",
    header: "Year",
    value: (r) => r.year,
    cell: (r) => (
      <span className="inline-flex items-center gap-2">
        <span className="num font-display text-lg font-bold">{r.year}</span>
        {isPreFranchise(r.year, startYear) && <Badge>NFL</Badge>}
      </span>
    ),
  },
  { id: "record", header: "W-L-T", align: "right", value: (r) => r.w, cell: (r) => formatRecord(r) },
  {
    id: "div",
    header: "Div",
    title: "Division finish",
    align: "right",
    value: (r) => r.divisionRank ?? null,
    cell: (r) => (r.divisionRank ? formatOrdinal(r.divisionRank) : ""),
  },
  { id: "seed", header: "Seed", align: "right", value: (r) => r.seed ?? null },
  {
    id: "result",
    header: "Playoffs",
    value: (r) => (r.playoffResult ? PLAYOFF_RESULT_LABELS[r.playoffResult] : ""),
    minWidth: 160,
  },
];

/**
 * Any team's history inside the franchise (FEATURES.md 5.6): seasons, titles, head-to-head
 * against the user team, the players we have seen on their roster, and their draft picks.
 */
export function TeamHistoryScreen({ abbr }: { abbr: string }) {
  const data = useQuery(api.league.teamHistory.get, { teamAbbr: abbr });
  const back = { to: "/league", label: "League" };
  if (data === undefined) {
    return (
      <Page title={abbr} back={back}>
        <Skeleton className="h-64 rounded-xl" />
      </Page>
    );
  }
  const { team, totals, headToHead } = data;
  return (
    <Page title={`${team.city} ${team.name}`} eyebrow={`${data.conference} ${data.division}`} back={back}>
      <div className="@container space-y-8">
        <div className="flex items-center gap-4">
          <TeamLogo team={team} size="xl" />
          <TileStrip className="flex-1">
            <Tile
              label="All-time"
              value={formatRecord(totals)}
              accent
              detail={`${data.seasons.length} seasons`}
            />
            <Tile
              label="Playoffs"
              value={`${totals.playoffW}-${totals.playoffL}`}
              detail={`${totals.playoffs} trips`}
            />
            <Tile
              label="Titles"
              value={totals.superBowls}
              detail={`${totals.conferenceTitles} conference, ${totals.divisionTitles} division`}
            />
            {!data.isUserTeam && (
              <Tile
                label="Against us"
                value={formatRecord(headToHead)}
                detail="Our record in the franchise"
              />
            )}
          </TileStrip>
        </div>

        <Section title="Seasons">
          <DataTable<SeasonRow>
            id="team-history-seasons"
            data={data.seasons}
            columns={seasonColumns(data.startYear)}
            getRowId={(r) => String(r.year)}
            identityColumn="year"
            primaryColumns={["record", "result"]}
            columnOptions={false}
            emptyState={<p className="p-4 text-sm text-muted-foreground">No seasons on record yet.</p>}
          />
        </Section>

        {!data.isUserTeam && headToHead.games.length > 0 && (
          <Section
            title="Head to head"
            description="Every franchise game against them, with the margin of each."
          >
            <TeamHeadToHead headToHead={headToHead} />
          </Section>
        )}

        <Section
          title="Players we have seen"
          description={
            data.isUserTeam
              ? "The latest rosters."
              : "From box scores, awards, leaders and roster screens; partial unless a roster page was captured."
          }
        >
          {data.players.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Nobody yet"
              description="Players appear as box scores and screens mention them."
            />
          ) : (
            <ul className="grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
              {data.players.map((p) => (
                <li key={p.playerId}>
                  <Link
                    to="/players/$playerId"
                    params={{ playerId: p.playerId }}
                    className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-3 hover:bg-surface-2"
                  >
                    <PositionBadge position={p.position} />
                    <span className="min-w-0 flex-1 truncate font-medium">{p.displayName}</span>
                    {p.ovr !== undefined && (
                      <span className="num text-sm text-muted-foreground">{p.ovr}</span>
                    )}
                    <span className="num text-xs text-subtle-foreground">{p.year}</span>
                  </Link>
                </li>
              ))}
            </ul>
          )}
        </Section>

        <Section title="Draft picks">
          {data.draftPicks.length === 0 ? (
            <p className="text-sm text-muted-foreground">No picks on record.</p>
          ) : (
            <ul className="grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
              {data.draftPicks.map((p) => (
                <li
                  key={p._id}
                  className="flex min-h-12 items-center gap-2.5 rounded-xl border border-border bg-surface px-3"
                >
                  <span className="num w-20 text-xs text-muted-foreground">
                    {p.year} · #{p.overall}
                  </span>
                  {p.position && <PositionBadge position={p.position} />}
                  {p.playerId ? (
                    <Link
                      to="/players/$playerId"
                      params={{ playerId: p.playerId }}
                      className="min-w-0 truncate font-medium hover:underline"
                    >
                      {p.name}
                    </Link>
                  ) : (
                    <span className="min-w-0 truncate font-medium">{p.name}</span>
                  )}
                  <span className="num ml-auto text-xs text-subtle-foreground">Rd {p.round}</span>
                </li>
              ))}
            </ul>
          )}
        </Section>
      </div>
    </Page>
  );
}

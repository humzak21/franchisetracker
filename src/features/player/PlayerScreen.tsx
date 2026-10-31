import { Link } from "@tanstack/react-router";
import { useAction, useMutation } from "convex/react";
import { Columns3, Gauge, Landmark, ScanFace } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { POSITION_INFO } from "@shared/domain";
import { leadStats } from "@shared/stats";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { CareerCurves } from "@/components/player/CareerCurves";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { CareerStatsTable } from "./CareerStatsTable";
import { EspnMatchSheet } from "./EspnMatchSheet";
import { GameLog } from "./GameLog";
import { HallOfFameSheet } from "./HallOfFameSheet";
import { IdentityPanel } from "./IdentityPanel";
import { OvrProgression } from "./OvrProgression";
import { PlayerActivity } from "./PlayerActivity";
import { PlayerEditActions } from "./PlayerEditActions";
import { PlayerHero } from "./PlayerHero";
import { PlayerHighlights } from "./PlayerHighlights";
import { PlayerMilestones } from "./PlayerMilestones";
import { PlayerPace } from "./PlayerPace";
import { PlayerStatCards } from "./PlayerStatCards";
import { PossibleDuplicate } from "./PossibleDuplicate";
import { RatingsSheet } from "./RatingsSheet";
import { RosterHistoryTable } from "./RosterHistoryTable";
import { useQuery } from "@/lib/convex/useQuery";

const SECTIONS = [
  { id: "stats", label: "Stats" },
  { id: "milestones", label: "Milestones" },
  { id: "progression", label: "OVR" },
  { id: "career", label: "Career" },
  { id: "trends", label: "Trends" },
  { id: "cumulative", label: "Cumulative" },
  { id: "games", label: "Game log" },
  { id: "rosters", label: "Rosters" },
  { id: "activity", label: "Awards" },
  { id: "identity", label: "Identity" },
  { id: "notes", label: "Notes" },
] as const;

/**
 * Player page (FEATURES.md 5.4): the card and bio, stat cards, pace in a live season, records and
 * streaks, milestones, OVR progression, career stats (real NFL seasons first, marked), trends and cumulative
 * curves, game logs, roster history, identity tools and notes. Jump links keep it navigable on a phone.
 */
export function PlayerScreen({ playerId }: { playerId: Id<"players"> }) {
  const page = useQuery(api.players.player.get, { playerId });
  const plaque = useQuery(api.hof.entries.forPlayer, { playerId });
  const updateNotes = useMutation(api.players.player.updateNotes);
  const ensureHeadshot = useAction(api.players.headshots.ensure);
  const teams = useQuery(api.league.teams.list, {});
  const teamOptions = useMemo(
    () => (teams ?? []).map((t) => ({ value: t._id, label: `${t.city} ${t.name}` })),
    [teams],
  );
  const [espnOpen, setEspnOpen] = useState(false);
  const [ratingsOpen, setRatingsOpen] = useState(false);
  const [hofOpen, setHofOpen] = useState(false);
  const trends = useQuery(api.stats.trends.player, { playerId });
  const position = page?.player.position;
  const latest = page?.history[page.history.length - 1];
  const shownPosition = latest?.entry.position ?? position;
  const lead = useMemo(() => (shownPosition ? leadStats(shownPosition) : []), [shownPosition]);

  // Cache this player's photo the first time anyone opens the page; a no-op once cached.
  useEffect(() => {
    void ensureHeadshot({ playerId }).catch(() => undefined);
  }, [ensureHeadshot, playerId]);

  return (
    <Page
      title={page?.player.displayName ?? "Player"}
      eyebrow={position ? POSITION_INFO[position].label : undefined}
      back={{ to: "/players", label: "Players" }}
    >
      {page === undefined ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-72 rounded-2xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          <PlayerHero
            page={page}
            actions={
              <>
                <PlayerEditActions page={page} teams={teamOptions} />
                <Button asChild size="sm" variant="outline">
                  <Link to="/players/compare" search={{ ids: [playerId] }}>
                    <Columns3 /> Compare
                  </Link>
                </Button>
                {latest && (
                  <Button size="sm" variant="outline" onClick={() => setRatingsOpen(true)}>
                    <Gauge /> Ratings
                  </Button>
                )}
                <Button size="sm" variant="outline" onClick={() => setEspnOpen(true)}>
                  <ScanFace /> {page.player.espnId ? "ESPN match" : "Find on ESPN"}
                </Button>
                {plaque && (
                  <Button
                    size="sm"
                    variant={plaque.entry ? "primary" : "outline"}
                    onClick={() => setHofOpen(true)}
                  >
                    <Landmark />{" "}
                    {plaque.entry ? `Hall of Fame · ${plaque.entry.inductedYear}` : "Hall of Fame"}
                  </Button>
                )}
              </>
            }
          />
          <PossibleDuplicate playerId={playerId} />
          <JumpLinks links={SECTIONS} />
          <Section id="stats" title="Stats">
            <PlayerStatCards page={page} />
          </Section>
          {trends && <PlayerPace trends={trends} stats={lead} />}
          <PlayerHighlights playerId={playerId} />
          <PlayerMilestones playerId={playerId} />
          <Section id="progression" title="OVR progression">
            <OvrProgression playerId={playerId} />
          </Section>
          <Section
            id="career"
            title="Career stats"
            description={`Seasons marked NFL are real seasons before the franchise began in ${page.startYear}.`}
          >
            <CareerStatsTable page={page} />
          </Section>
          {trends === undefined ? (
            <Skeleton className="h-64 rounded-xl" />
          ) : (
            <CareerCurves
              key={playerId}
              data={trends}
              initialStat={lead[0]}
              anchors={{ trends: "trends", cumulative: "cumulative" }}
            />
          )}
          <Section id="games" title="Game log">
            <GameLog page={page} />
          </Section>
          <Section id="rosters" title="Roster history">
            <RosterHistoryTable page={page} teams={teamOptions} />
          </Section>
          <Section id="activity" title="Awards and moves">
            <PlayerActivity playerId={playerId} />
          </Section>
          <Section id="identity" title="Identity">
            <IdentityPanel key={page.player._id + page.player.displayName} page={page} />
          </Section>
          <Section id="notes" title="Notes" variant="card">
            <NotesEditor
              label="Scouting notes"
              value={page.player.notes}
              placeholder="Development, role, contract thoughts…"
              onSave={(notes) => updateNotes({ playerId, notes })}
            />
          </Section>
          <EspnMatchSheet
            playerId={playerId}
            name={page.player.displayName}
            open={espnOpen}
            onOpenChange={setEspnOpen}
          />
          {plaque && (
            <HallOfFameSheet
              key={`${plaque.entry?._id ?? "new"}-${String(hofOpen)}`}
              playerId={playerId}
              name={page.player.displayName}
              plaque={plaque}
              open={hofOpen}
              onOpenChange={setHofOpen}
            />
          )}
          {latest && (
            <RatingsSheet
              key={latest.entry._id}
              row={latest}
              open={ratingsOpen}
              onOpenChange={setRatingsOpen}
            />
          )}
        </div>
      )}
    </Page>
  );
}

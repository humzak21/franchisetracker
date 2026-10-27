import { useMutation } from "convex/react";
import { CalendarOff, CalendarX2, ImageUp, Pencil } from "lucide-react";
import { useRef, useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel, weekPhase } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import { useCapture } from "@/app/capture/CaptureProvider";
import { EmptyState } from "@/components/data/EmptyState";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { SplitPane } from "@/components/layout/SplitPane";
import { ScoreBug } from "@/components/team/ScoreBug";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useQuery } from "@/lib/convex/useQuery";
import { BoxScore } from "./BoxScore";
import { EditGameSheet } from "./EditGameSheet";
import { GameNav } from "./GameNav";
import { HeadToHead } from "./HeadToHead";
import { StarsSection } from "./StarsSection";
import { TeamStatsCompare } from "./TeamStatsCompare";

/** Game detail: score bug, stars, team stats, notes, head-to-head and the full box score, all editable. */
export function GameDetailScreen({ gameId }: { gameId: string }) {
  const data = useQuery(api.games.schedule.get, { gameId: gameId as Id<"games"> });
  const saveNotes = useMutation(api.games.schedule.updateNotes);
  const capture = useCapture();
  const swipeArea = useRef<HTMLDivElement>(null);
  const [editing, setEditing] = useState(false);
  const nav = <GameNav data={data ?? undefined} swipeArea={swipeArea} />;

  if (data === undefined) {
    return (
      <Page title="Game" back={{ to: "/schedule", label: "Schedule" }} actions={nav}>
        <Skeleton className="h-40 rounded-xl" />
      </Page>
    );
  }

  if (data === null) {
    return (
      <Page title="Game" back={{ to: "/schedule", label: "Schedule" }}>
        <EmptyState icon={CalendarX2} title="Game not found" description="It was deleted or never existed." />
      </Page>
    );
  }

  const { game, season, userTeam, headToHead, header } = data;
  const opponent = game.opponent;
  const bye = game.status === "bye";
  const user = { team: userTeam, score: game.us, record: formatRecord(data.userRecordBefore) };
  const them = {
    team: opponent ?? userTeam,
    score: game.them,
    record: game.opponentRecord ? formatRecord(game.opponentRecord) : undefined,
  };
  const postseason = weekPhase(game.weekKey) === "postseason";
  const week = weekLabel(game.weekKey, postseason ? "long" : "short");
  // Short week labels keep the title on one line on phones; playoff rounds read better in full.
  const title = bye ? `${week} · Bye` : `${week} ${game.userIsHome ? "vs" : "at"} ${opponent?.name ?? "TBD"}`;
  const status =
    game.status === "played"
      ? postseason
        ? `Final · ${weekLabel(game.weekKey, "long")}`
        : "Final"
      : (game.dateLabel ?? "Not played yet");
  const details = [game.status === "played" ? game.dateLabel : null, header.stadium, header.weather]
    .filter(Boolean)
    .join(" · ");
  const importScreenshot = (targetKey: "game_box_score" | "team_game_stats") =>
    capture.open({ gameId: game._id, targetKey, gameLabel: `${season.year} · ${title}` });
  const sides = { user: userTeam, opponent };

  const notes = (
    <NotesEditor
      label="Game notes"
      value={game.notes ?? undefined}
      placeholder="What happened, who showed up, what to fix."
      onSave={(text) => saveNotes({ gameId: game._id, notes: text })}
    />
  );

  return (
    <Page
      title={title}
      eyebrow={`${season.year} · ${postseason ? "Postseason" : "Regular season"}`}
      back={{ to: "/schedule", label: "Schedule" }}
      actions={
        <>
          <Button size="sm" variant="outline" onClick={() => setEditing(true)} aria-label="Edit game">
            <Pencil /> Edit
          </Button>
          {nav}
        </>
      }
    >
      <div ref={swipeArea} className="space-y-6">
        {bye ? (
          <>
            <EmptyState
              icon={CalendarOff}
              title="Bye week"
              description="No game this week. Edit it to turn it into a game, or delete it."
            />
            {notes}
          </>
        ) : (
          <>
            <ScoreBug
              away={game.userIsHome ? them : user}
              home={game.userIsHome ? user : them}
              status={status}
              overtime={game.overtime}
              userTeam={userTeam.abbr}
            />
            {details && <p className="-mt-3 text-center text-sm text-muted-foreground">{details}</p>}
            <SplitPane
              ratio="3fr 2fr"
              panes={[
                {
                  id: "game",
                  label: "Game",
                  content: (
                    <div className="space-y-6">
                      <StarsSection gameId={game._id} stars={data.stars} {...sides} />
                      <TeamStatsCompare
                        gameId={game._id}
                        onImport={() => importScreenshot("team_game_stats")}
                      />
                    </div>
                  ),
                },
                {
                  id: "notes",
                  label: "Notes",
                  content: (
                    <div className="space-y-6">
                      {notes}
                      {opponent && headToHead.games.length > 0 && (
                        <Section title="Head to head">
                          <HeadToHead data={headToHead} opponent={opponent.name} currentGameId={game._id} />
                        </Section>
                      )}
                    </div>
                  ),
                },
              ]}
            />
            <Section
              title="Box score"
              actions={
                <Button size="sm" variant="outline" onClick={() => importScreenshot("game_box_score")}>
                  <ImageUp /> Import screenshot
                </Button>
              }
            >
              <BoxScore gameId={game._id} onImport={() => importScreenshot("game_box_score")} />
            </Section>
          </>
        )}
      </div>
      <EditGameSheet open={editing} onOpenChange={setEditing} data={data} />
    </Page>
  );
}

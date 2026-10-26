import { Link, useNavigate } from "@tanstack/react-router";
import { useMutation, useQuery } from "convex/react";
import { ChevronLeft, ChevronRight, ImageUp } from "lucide-react";
import { useRef } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { weekLabel, weekPhase } from "@shared/domain";
import { formatRecord } from "@shared/stats";
import { useShortcut } from "@/app/keyboard";
import { EmptyState } from "@/components/data/EmptyState";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { SplitPane } from "@/components/layout/SplitPane";
import { ScoreBug } from "@/components/team/ScoreBug";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { useSwipe } from "@/lib/hooks/useSwipe";
import { HeadToHead } from "./HeadToHead";
import { ThreeStars } from "./ThreeStars";

/** Game detail v1: score bug, three stars, notes, head-to-head; the box score arrives in Sprint 2. */
export function GameDetailScreen({ gameId }: { gameId: string }) {
  const data = useQuery(api.games.schedule.get, { gameId: gameId as Id<"games"> });
  const saveNotes = useMutation(api.games.schedule.updateNotes);
  const navigate = useNavigate();
  const swipeArea = useRef<HTMLDivElement>(null);

  const go = (id: Id<"games"> | null | undefined) =>
    id && void navigate({ to: "/games/$gameId", params: { gameId: id } });
  useShortcut("game-prev", {
    key: "[",
    label: "Previous game",
    touch: "Swipe right",
    handler: () => go(data?.previousGameId),
  });
  useShortcut("game-next", {
    key: "]",
    label: "Next game",
    touch: "Swipe left",
    handler: () => go(data?.nextGameId),
  });
  useSwipe(swipeArea, {
    onSwipeLeft: () => go(data?.nextGameId),
    onSwipeRight: () => go(data?.previousGameId),
  });

  if (data === undefined) {
    return (
      <Page title="Game" back={{ to: "/schedule", label: "Schedule" }}>
        <Skeleton className="h-40 rounded-xl" />
      </Page>
    );
  }

  const { game, season, userTeam, headToHead } = data;
  const opponent = game.opponent;
  const user = { team: userTeam, score: game.us, record: formatRecord(data.userRecordBefore) };
  const them = {
    team: opponent ?? userTeam,
    score: game.them,
    record: game.opponentRecord ? formatRecord(game.opponentRecord) : undefined,
  };
  const postseason = weekPhase(game.weekKey) === "postseason";
  // Short week labels keep the title on one line on phones; playoff rounds read better in full.
  const title = `${weekLabel(game.weekKey, postseason ? "long" : "short")} ${game.userIsHome === false ? "at" : "vs"} ${opponent?.name ?? "TBD"}`;

  const nav = (
    <>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!data.previousGameId}
        onClick={() => go(data.previousGameId)}
        aria-label="Previous game"
      >
        <ChevronLeft />
      </Button>
      <Button
        variant="ghost"
        size="icon-sm"
        disabled={!data.nextGameId}
        onClick={() => go(data.nextGameId)}
        aria-label="Next game"
      >
        <ChevronRight />
      </Button>
    </>
  );

  return (
    <Page
      title={title}
      eyebrow={`${season.year} · ${postseason ? "Postseason" : "Regular season"}`}
      back={{ to: "/schedule", label: "Schedule" }}
      actions={nav}
    >
      <div ref={swipeArea} className="space-y-6">
        <ScoreBug
          // When home and away are unknown (imported games), the user team takes the home slot.
          away={game.userIsHome === false ? user : them}
          home={game.userIsHome === false ? them : user}
          status={postseason ? `Final · ${weekLabel(game.weekKey, "long")}` : "Final"}
          overtime={game.overtime}
          userTeam={userTeam.abbr}
        />
        <SplitPane
          ratio="3fr 2fr"
          panes={[
            {
              id: "game",
              label: "Game",
              content: (
                <div className="space-y-6">
                  <Section title="Three stars">
                    <ThreeStars stars={data.stars} team={userTeam} />
                  </Section>
                  <Section title="Box score">
                    <EmptyState
                      icon={ImageUp}
                      title="No box score yet"
                      description="Snap the box score screens and import them; passing, rushing, receiving and defense fill in here."
                      action={
                        <Button asChild variant="primary">
                          <Link to="/inbox">Import screenshot</Link>
                        </Button>
                      }
                    />
                  </Section>
                </div>
              ),
            },
            {
              id: "notes",
              label: "Notes",
              content: (
                <div className="space-y-6">
                  <NotesEditor
                    label="Game notes"
                    value={game.notes ?? undefined}
                    placeholder="What happened, who showed up, what to fix."
                    onSave={(notes) => saveNotes({ gameId: game._id, notes })}
                  />
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
      </div>
    </Page>
  );
}

import { useMutation, useQuery } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { POSITION_INFO } from "@shared/domain";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Skeleton } from "@/components/ui/misc";
import { CareerStatsTable } from "./CareerStatsTable";
import { PlayerHero } from "./PlayerHero";
import { RosterHistoryTable } from "./RosterHistoryTable";

/** Player page v1 (FEATURES.md 5.4): hero, career stats, roster history and notes. */
export function PlayerScreen({ playerId }: { playerId: Id<"players"> }) {
  const page = useQuery(api.players.player.get, { playerId });
  const updateNotes = useMutation(api.players.player.updateNotes);
  const position = page?.player.position;

  return (
    <Page
      title={page?.player.displayName ?? "Player"}
      eyebrow={position ? POSITION_INFO[position].label : undefined}
      back={{ to: "/roster", label: "Roster" }}
    >
      {page === undefined ? (
        <div className="space-y-6" aria-busy="true">
          <Skeleton className="h-44 rounded-2xl" />
          <Skeleton className="h-64 rounded-xl" />
        </div>
      ) : (
        <div className="space-y-8">
          <PlayerHero page={page} />
          <Section
            title="Career stats"
            description="Regular season, from imported season totals and game logs."
          >
            <CareerStatsTable page={page} />
          </Section>
          <Section title="Roster history">
            <RosterHistoryTable page={page} />
          </Section>
          <Section title="Notes" variant="card">
            <NotesEditor
              label="Scouting notes"
              value={page.player.notes}
              placeholder="Development, role, contract thoughts…"
              onSave={(notes) => updateNotes({ playerId, notes })}
            />
          </Section>
        </div>
      )}
    </Page>
  );
}

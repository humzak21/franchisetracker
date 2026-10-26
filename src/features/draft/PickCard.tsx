import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { useMutation } from "convex/react";
import { Pencil } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { NotesEditor } from "@/components/forms/NotesEditor";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { PlayerChip } from "@/components/player/PlayerChip";
import { PositionBadge } from "@/components/player/PositionBadge";
import { TeamChip } from "@/components/team/TeamChip";
import { Button } from "@/components/ui/button";
import { cn } from "@/lib/cn";
import { GradeBadge } from "./GradeBadge";

export type DraftPick = FunctionReturnType<typeof api.draft.draft.bySeason>["picks"][number];

/** One pick: slot, team, player, position and college; the user team's picks carry a grade and notes. */
export function PickCard({ pick }: { pick: DraftPick }) {
  const update = useMutation(api.draft.draft.updatePick);
  const [editing, setEditing] = useState(false);
  return (
    <article
      className={cn(
        "rounded-xl border bg-surface p-3",
        pick.isUser ? "border-primary/60 bg-elite-1" : "border-border",
      )}
    >
      <div className="flex items-center gap-2">
        <span className="num font-display text-lg font-bold">#{pick.overall}</span>
        <TeamChip team={pick.team} label="abbr" size="xs" />
        {pick.originTeam && <span className="text-xs text-muted-foreground">via {pick.originTeam.abbr}</span>}
        <span className="ml-auto flex items-center gap-1.5">
          <GradeBadge grade={pick.grade} />
          {pick.isUser && (
            <Button
              size="icon-sm"
              variant="ghost"
              aria-label={`Notes on pick ${pick.overall}`}
              onClick={() => setEditing(true)}
            >
              <Pencil />
            </Button>
          )}
        </span>
      </div>
      <div className="mt-2 flex items-center gap-2">
        {pick.player ? (
          <Link
            to="/players/$playerId"
            params={{ playerId: pick.player._id }}
            className="min-w-0 flex-1 hover:underline"
          >
            <PlayerChip player={{ ...pick.player, team: pick.team }} size="sm" caption={pick.college} />
          </Link>
        ) : (
          <span className="min-w-0 flex-1">
            <span className="block truncate font-medium">{pick.name}</span>
            {pick.college && (
              <span className="block truncate text-xs text-muted-foreground">{pick.college}</span>
            )}
          </span>
        )}
        {pick.position && !pick.player && <PositionBadge position={pick.position} />}
        {pick.ovrAtDraft !== undefined && (
          <span className="num text-xs text-muted-foreground">{pick.ovrAtDraft} OVR</span>
        )}
      </div>
      {pick.notes && <p className="mt-2 line-clamp-2 text-xs text-muted-foreground">{pick.notes}</p>}
      {pick.isUser && (
        <BottomSheet open={editing} onOpenChange={setEditing} title={`Pick ${pick.overall}: ${pick.name}`}>
          <div className="space-y-4">
            <NotesEditor
              label="Notes"
              rows={4}
              value={pick.notes}
              onSave={(notes) => update({ pickId: pick._id, notes })}
            />
            <NotesEditor
              label="Trade note"
              rows={2}
              value={pick.tradeNote}
              placeholder="Where this pick came from, if it was traded"
              onSave={(tradeNote) => update({ pickId: pick._id, tradeNote })}
            />
          </div>
        </BottomSheet>
      )}
    </article>
  );
}

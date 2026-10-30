import { Search, UserPlus } from "lucide-react";
import { useState } from "react";
import type { Id } from "@convex/_generated/dataModel";
import { normalizePosition, ROSTER_STATUS_LABELS } from "@shared/domain";
import type { PlayerMatch } from "@shared/ingestion/types";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Input } from "@/components/ui/input";
import { getAt, pickerContext, type PlayerChoice } from "./draftEdit";
import { PickerGroup } from "./PickerGroup";
import { PickerOption } from "./PickerOption";
import { usePlayerSearch, useProspectSearch, useTeamRoster } from "./playerSearch";
import { useReviewDraft } from "./reviewDraft";

type PlayerPickerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  /** Where the draft keeps this line or row, which says whose roster to offer. */
  base: string;
  printedName: string;
  match: PlayerMatch<Id<"players">>;
  value: Id<"players"> | null;
  /** The row is a draft pick: search college football too, since he may be a real prospect. */
  prospects?: boolean;
  /** The row stays as printed rather than creating a player; its candidates come from the box score. */
  noNewPlayers?: boolean;
  onChange: (choice: PlayerChoice) => void;
};

/**
 * Who a printed name is: the rosters' best guesses, the team's known players at that position, a
 * search of every player (and of college football for a draft pick), or a new player named as
 * printed or as typed.
 */
export function PlayerPickerSheet({
  open,
  onOpenChange,
  base,
  printedName,
  match,
  value,
  prospects = false,
  noNewPlayers = false,
  onChange,
}: PlayerPickerSheetProps) {
  const [text, setText] = useState("");
  const typed = text.trim();
  const { draft, seasonId } = useReviewDraft();
  const { teamAbbr, position } = pickerContext(draft, base);
  // On a game, no player yet is a question, not a choice of a new player.
  const newChosen = !base.startsWith("lines.") || getAt(draft, `${base}.confirmedNew`) === true;
  const franchise = usePlayerSearch(text, open);
  const college = useProspectSearch(text, open && prospects);
  const offered = new Set(match.candidates.map((c) => c.playerId));
  // A draft pick is new to the league, and a scoring play's choices are the box score's.
  const roster = useTeamRoster(seasonId, teamAbbr, position, open && !prospects && !noNewPlayers).filter(
    (p) => !offered.has(p._id),
  );
  const choose = (choice: PlayerChoice) => {
    onChange(choice);
    onOpenChange(false);
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      textEntry
      title={printedName}
      description="Which player is this? Your choice is remembered for this team and season."
    >
      <div className="space-y-4">
        <label className="sticky top-0 z-10 block bg-surface pb-1">
          <Search className="absolute top-[calc(50%-2px)] left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
          <Input
            value={text}
            onChange={(e) => setText(e.target.value)}
            placeholder={prospects ? "Search players, or type his full name" : "Search every player"}
            className="pl-9"
            aria-label="Search players"
            autoComplete="off"
            autoCorrect="off"
            spellCheck={false}
          />
        </label>
        {!noNewPlayers && (
          <ul aria-label="New player" className="space-y-1">
            {typed.length >= 2 && typed !== printedName && (
              <PickerOption
                icon={<UserPlus className="size-4 shrink-0 text-primary" />}
                label={`Add “${typed}” as a new player`}
                onClick={() => choose({ kind: "new", name: typed })}
              />
            )}
            <PickerOption
              icon={<UserPlus className="size-4 shrink-0 text-primary" />}
              label={typed ? `Keep “${printedName}” as a new player` : "Add as a new player"}
              selected={value === null && newChosen}
              onClick={() => choose({ kind: "new", name: printedName })}
            />
          </ul>
        )}
        {match.candidates.length > 0 && (
          <PickerGroup label="Likely players" searching={false} empty="" count={match.candidates.length}>
            {match.candidates.map((c) => (
              <PickerOption
                key={c.playerId}
                label={c.name}
                detail={noNewPlayers ? "In the box score" : `${Math.round(c.score * 100)}% match`}
                selected={value === c.playerId}
                onClick={() => choose({ kind: "player", _id: c.playerId, name: c.name })}
              />
            ))}
          </PickerGroup>
        )}
        {roster.length > 0 && (
          <PickerGroup
            label={`${teamAbbr} ${position ? `at ${position}` : "roster"}`}
            searching={false}
            empty=""
            count={roster.length}
          >
            {roster.map((p) => (
              <PickerOption
                key={p._id}
                label={p.displayName}
                position={p.position}
                detail={[
                  p.jersey === null ? null : `#${p.jersey}`,
                  p.status === "active" ? null : ROSTER_STATUS_LABELS[p.status],
                ]
                  .filter(Boolean)
                  .join(" · ")}
                selected={value === p._id}
                onClick={() => choose({ kind: "player", _id: p._id, name: p.displayName })}
              />
            ))}
          </PickerGroup>
        )}
        {typed.length >= 2 && (
          <PickerGroup
            label="In this franchise"
            searching={franchise.searching}
            empty="No players by that name"
            count={franchise.players.length}
          >
            {franchise.players.map((p) => (
              <PickerOption
                key={p._id}
                label={p.displayName}
                position={p.position}
                detail={p.college}
                selected={value === p._id}
                onClick={() => choose({ kind: "player", _id: p._id, name: p.displayName })}
              />
            ))}
          </PickerGroup>
        )}
        {prospects && typed.length >= 3 && (
          <PickerGroup
            label="College football"
            searching={college.searching}
            empty={college.failed ? "ESPN did not answer; try again" : "No college players by that name"}
            count={college.prospects.length}
          >
            {college.prospects.map((c) => {
              // ESPN's "RB" is Madden's "HB": show and keep the app's own position.
              const position = c.position ? normalizePosition(c.position) : null;
              return (
                <PickerOption
                  key={c.espnId}
                  label={c.name}
                  position={position ?? c.position}
                  detail={[c.college, c.classYear].filter(Boolean).join(" · ") || null}
                  onClick={() =>
                    choose({ kind: "prospect", espnId: c.espnId, name: c.name, position, college: c.college })
                  }
                />
              );
            })}
          </PickerGroup>
        )}
      </div>
    </BottomSheet>
  );
}

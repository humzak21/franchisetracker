import { useState } from "react";
import { Segmented } from "@/components/ui/segmented";
import { LineEditor } from "./LineEditor";
import { useReviewDraft } from "./reviewDraft";

const UNASSIGNED = "?";

/** Every player line, one team at a time so a phone screen is never two rosters long. */
export function BoxScoreEditor() {
  const { draft } = useReviewDraft();
  const teams = [draft.game.awayAbbr, draft.game.homeAbbr].filter((t): t is string => t !== null);
  const [team, setTeam] = useState<string>(teams[0] ?? UNASSIGNED);
  if (draft.target !== "game_box_score") return null;

  const groups = [
    ...teams.map((abbr) => ({
      value: abbr,
      label: abbr,
      lines: draft.lines.filter((l) => l.teamAbbr === abbr),
    })),
    {
      value: UNASSIGNED,
      label: "No team",
      lines: draft.lines.filter((l) => !l.teamAbbr || !teams.includes(l.teamAbbr)),
    },
  ].filter((g) => g.value !== UNASSIGNED || g.lines.length > 0);
  const active = groups.find((g) => g.value === team) ?? groups[0];

  return (
    <div className="@container space-y-3">
      <Segmented
        className="flex w-full"
        aria-label="Team"
        value={active?.value ?? UNASSIGNED}
        onChange={setTeam}
        options={groups.map((g) => ({ value: g.value, label: g.label, count: g.lines.length }))}
      />
      {active?.lines.map((line) => (
        <LineEditor key={line.id} line={line} teams={teams} />
      ))}
      {active?.lines.length === 0 && (
        <p className="py-6 text-center text-sm text-muted-foreground">No players read for this team.</p>
      )}
    </div>
  );
}

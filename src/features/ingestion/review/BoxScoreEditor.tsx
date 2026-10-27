import { Plus } from "lucide-react";
import { useState } from "react";
import { newLine } from "@shared/ingestion/manual";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { AddPlayerSheet } from "./AddPlayerSheet";
import { LineEditor } from "./LineEditor";
import { useReviewDraft } from "./reviewDraft";

const UNASSIGNED = "?";

/** Every player line, one team at a time so a phone screen is never two rosters long. */
export function BoxScoreEditor() {
  const { draft, update } = useReviewDraft();
  const [adding, setAdding] = useState(false);
  const header = "game" in draft ? [draft.game.awayAbbr, draft.game.homeAbbr] : [];
  const teams = header.filter((t): t is string => t !== null);
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
  const teamAbbr = active && active.value !== UNASSIGNED ? active.value : null;

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
        <p className="py-6 text-center text-sm text-muted-foreground">No players for this team yet.</p>
      )}
      <Button variant="outline" className="w-full" onClick={() => setAdding(true)}>
        <Plus /> Add a player{teamAbbr ? ` for ${teamAbbr}` : ""}
      </Button>
      <AddPlayerSheet
        open={adding}
        onOpenChange={setAdding}
        title={`Add a player${teamAbbr ? ` for ${teamAbbr}` : ""}`}
        onAdd={(who) =>
          update((d) =>
            d.target === "game_box_score"
              ? { ...d, lines: [...d.lines, newLine(d.lines, { ...who, teamAbbr })] }
              : d,
          )
        }
      />
    </div>
  );
}

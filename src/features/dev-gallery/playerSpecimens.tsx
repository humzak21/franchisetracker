import { History } from "lucide-react";
import { useState } from "react";
import { Notice } from "@/components/data/Notice";
import { RadarCompare } from "@/components/data/RadarCompare";
import { TrendChart } from "@/components/data/TrendChart";
import { JumpLinks } from "@/components/layout/JumpLinks";
import { MatchCandidate } from "@/components/player/MatchCandidate";
import { MovePlayerSheet } from "@/components/player/MovePlayerSheet";
import { PlayerCard } from "@/components/player/PlayerCard";
import { Button } from "@/components/ui/button";
import { BUF, KC, NE, PLAYERS } from "./fixtures";
import type { Specimen } from "./specimens";

const OVR = [
  { key: "24", label: "2024 · Roster", group: "2024", value: 74 },
  { key: "25", label: "2025 · Roster", group: "2025", value: 79 },
  { key: "25-w8", label: "2025 · Week 8", group: "2025", value: 81 },
  { key: "26", label: "2026 · Roster", group: "2026", value: 84 },
  { key: "26-w4", label: "2026 · Week 4", group: "2026", value: 85 },
  { key: "26-w12", label: "2026 · Week 12", group: "2026", value: 88 },
];

/** The move sheet against local state; a screen passes the move mutation. */
function MoveSheetDemo() {
  const [open, setOpen] = useState(false);
  return (
    <>
      <Button size="sm" variant="outline" onClick={() => setOpen(true)}>
        Move Drake Maye…
      </Button>
      <MovePlayerSheet
        open={open}
        onOpenChange={setOpen}
        name="Drake Maye"
        seasons={[{ value: "s26", label: "2026" }]}
        teams={[NE, BUF].map((t) => ({ value: t.abbr, label: t.abbr }))}
        initial={{ seasonId: "s26", teamId: NE.abbr, status: "active" }}
        onMove={() => Promise.resolve()}
      />
    </>
  );
}

export const PLAYER_SPECIMENS: Specimen[] = [
  {
    id: "playercard",
    name: "PlayerCard",
    note: "Fills its parent's width at a card ratio. Real players show their ESPN headshot; fictional ones (shown) get a monogram in team colors.",
    render: () => (
      <div className="@container">
        <div className="grid grid-cols-2 gap-3 @tablet:grid-cols-4">
          <PlayerCard player={PLAYERS.maye} caption="2024–2026" />
          <PlayerCard player={{ ...PLAYERS.diggs, team: BUF }} caption="2015–2026" />
          <PlayerCard player={{ ...PLAYERS.gonzalez, team: KC }} />
          <PlayerCard
            player={{ displayName: "Created Player", position: "LEDG", team: NE }}
            caption="Fictional"
          />
        </div>
      </div>
    ),
  },
  {
    id: "trendchart",
    name: "TrendChart",
    note: "OVR progression: one tick per season, checkpoints between. Shorter with no grid at phone width.",
    render: () => <TrendChart points={OVR} valueLabel="OVR" />,
  },
  {
    id: "radarcompare",
    name: "RadarCompare",
    note: "Compare's shape view: each spoke is a share of the best in the group, series in team colors.",
    render: () => (
      <RadarCompare
        axes={["CMP", "ATT", "YDS", "TD", "RUSH", "RYDS"].map((label) => ({ key: label, label }))}
        series={[
          {
            id: "a",
            name: "Drake Maye",
            color: "var(--team-accent)",
            values: { CMP: 0.6, ATT: 0.62, YDS: 0.58, TD: 0.55, RUSH: 1, RYDS: 1 },
          },
          {
            id: "b",
            name: "Josh Allen",
            color: "var(--ot)",
            values: { CMP: 1, ATT: 1, YDS: 1, TD: 1, RUSH: 0.7, RYDS: 0.8 },
          },
        ]}
      />
    ),
  },
  {
    id: "jumplinks",
    name: "JumpLinks",
    note: "Section jump links for long pages; sticks under the header and scrolls sideways on a phone.",
    render: () => (
      <JumpLinks
        className="static mx-0 @tablet:mx-0"
        links={["Stats", "OVR", "Career", "Game log", "Rosters", "Identity", "Notes"].map((label) => ({
          id: `jump-${label}`,
          label,
        }))}
      />
    ),
  },
  {
    id: "matchcandidate",
    name: "MatchCandidate",
    note: "A possible ESPN match in the confirm sheets, NFL or college prospect: face, name, league and the facts that tell namesakes apart.",
    render: () => (
      <div className="space-y-2">
        <MatchCandidate
          candidate={{
            name: "Drake Maye",
            league: "nfl",
            position: "QB",
            teamAbbr: "NE",
            college: "North Carolina",
            classYear: null,
            age: 24,
            headshotUrl: null,
          }}
          action={
            <Button size="sm" variant="primary">
              This is him
            </Button>
          }
        />
        <MatchCandidate
          candidate={{
            name: "Arch Manning",
            league: "college",
            position: "QB",
            teamAbbr: "TEX",
            college: "Texas",
            classYear: "Senior",
            age: null,
            headshotUrl: null,
          }}
        />
      </div>
    ),
  },
  {
    id: "moveplayersheet",
    name: "MovePlayerSheet",
    note: "Moves a player by hand, no transaction logged: team, status and week for a season; changing teams asks whether the old team traded or released him.",
    render: () => <MoveSheetDemo />,
  },
  {
    id: "notice",
    name: "Notice",
    note: "Where a view's numbers come from: here, a real NFL season before the franchise.",
    render: () => (
      <Notice icon={History}>
        2025 is real NFL history: season totals imported from nflverse. Records, leaders and streaks count
        only the seasons you play.
      </Notice>
    ),
  },
];

import { Inbox, Plus } from "lucide-react";
import type { ReactNode } from "react";
import { NFL_TEAMS } from "@shared/domain";
import { formatRecord, statValue } from "@shared/stats";
import { EmptyState } from "@/components/data/EmptyState";
import { Highlight } from "@/components/data/Highlight";
import { RankBadge } from "@/components/data/RankBadge";
import { RankRibbon } from "@/components/data/RankRibbon";
import { Sparkline } from "@/components/data/Sparkline";
import { StatCard } from "@/components/data/StatCard";
import { StatCell } from "@/components/data/StatCell";
import { Section } from "@/components/layout/Section";
import { SplitPane } from "@/components/layout/SplitPane";
import { Headshot } from "@/components/player/Headshot";
import { PlayerChip } from "@/components/player/PlayerChip";
import { PositionBadge } from "@/components/player/PositionBadge";
import { ScoreBug } from "@/components/team/ScoreBug";
import { TeamChip } from "@/components/team/TeamChip";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/misc";
import {
  BUF,
  DIGGS_WEEKLY_REC,
  KC,
  MAYE_2025,
  MAYE_WEEKLY_YDS,
  NE,
  PLAYERS,
  TEAM_STATS_2025,
} from "./fixtures";
import { SegmentedDemo, SheetDemo, TeamPickerDemo } from "./demos";
import { INGESTION_SPECIMENS } from "./ingestionSpecimens";
import { TABLE_SPECIMENS } from "./tableSpecimens";

export type Specimen = { id: string; name: string; note?: string; render: () => ReactNode };

export const SPECIMENS: Specimen[] = [
  {
    id: "scorebug",
    name: "ScoreBug",
    note: "Stacked rows at phone width, one broadcast strip above 640 px. Scores count up.",
    render: () => (
      <div className="space-y-3">
        <ScoreBug
          away={{ team: BUF, score: 24, record: "9-4" }}
          home={{ team: NE, score: 31, record: "10-3" }}
          status="Final · W14"
          userTeam="NE"
        />
        <ScoreBug
          away={{ team: NE, score: 27, record: "14-3" }}
          home={{ team: KC, score: 30, record: "15-2" }}
          status="Final · AFC Championship"
          overtime
          userTeam="NE"
        />
        <ScoreBug
          away={{ team: KC, score: null, record: "2-1" }}
          home={{ team: NE, score: null, record: "3-0" }}
          status="W4 · Sunday"
          userTeam="NE"
        />
      </div>
    ),
  },
  ...TABLE_SPECIMENS,
  ...INGESTION_SPECIMENS,
  {
    id: "statcell",
    name: "StatCell · Highlight",
    note: "Registry formatting and two elite tiers driven by team colors.",
    render: () => (
      <div className="flex flex-wrap items-center gap-x-6 gap-y-3 text-sm">
        <span>
          Plain <StatCell stat="recYds" value={935} highlight />
        </span>
        <span>
          Tier 1 <StatCell stat="recYds" value={1054} highlight />
        </span>
        <span>
          Tier 2 <StatCell stat="recYds" value={1687} highlight />
        </span>
        <span>
          Rate <StatCell stat="passCmpPct" value={statValue("passCmpPct", MAYE_2025)} highlight />
        </span>
        <span>
          Rating <StatCell stat="passRating" value={statValue("passRating", MAYE_2025)} highlight />
        </span>
        <span>
          Half sacks <StatCell stat="sacks" value={3.5} />
        </span>
        <span>
          Missing <StatCell stat="fgPct" value={null} />
        </span>
        <span>
          Badge <Highlight tier={2}>300+</Highlight>
        </span>
      </div>
    ),
  },
  {
    id: "statcard",
    name: "StatCard",
    render: () => (
      <StatCard
        title="Stefon Diggs"
        subtitle="2025 · 17 GP"
        groups={[
          {
            title: "Receiving",
            items: [
              { stat: "rec", value: 120, trend: DIGGS_WEEKLY_REC },
              { stat: "recYds", value: 1687 },
              { stat: "recTd", value: 21 },
              { stat: "recAvg", value: 14.1 },
              { stat: "recYpg", value: 99.2 },
              { stat: "recLong", value: 64 },
            ],
          },
        ]}
        footer="Career year in every category."
      />
    ),
  },
  {
    id: "rank",
    name: "RankRibbon · RankBadge",
    note: 'Team stats as rank ribbons instead of "27.3 - T-3rd" strings.',
    render: () => (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          {[1, 3, 8, 16, 26, 32].map((r) => (
            <RankBadge key={r} rank={r} tied={r === 3} />
          ))}
        </div>
        <div className="grid gap-4 @tablet:grid-cols-2">
          {TEAM_STATS_2025.map((t) => (
            <RankRibbon key={t.label} {...t} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "sparkline",
    name: "Sparkline",
    render: () => (
      <div className="flex flex-wrap items-center gap-6 text-sm">
        <span className="flex items-center gap-3">
          Maye passing yards <Sparkline values={MAYE_WEEKLY_YDS} width={140} height={32} />
        </span>
        <span className="flex items-center gap-3">
          Diggs catches <Sparkline values={DIGGS_WEEKLY_REC} area={false} />
        </span>
      </div>
    ),
  },
  {
    id: "player",
    name: "PlayerChip · Headshot · PositionBadge",
    render: () => (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-6 gap-y-3">
          <PlayerChip player={PLAYERS.maye} caption="20/26, 203 yds, 2 TD" />
          <PlayerChip player={PLAYERS.diggs} caption="8 rec, 131 yds, 1 TD" />
          <PlayerChip player={PLAYERS.spillane} size="sm" />
        </div>
        <div className="flex flex-wrap items-end gap-3">
          {(["xs", "sm", "md", "lg", "xl"] as const).map((size) => (
            <Headshot key={size} name="Drake Maye" team={NE} size={size} />
          ))}
        </div>
        <div className="flex flex-wrap gap-1.5">
          {["QB", "HB", "WR", "TE", "LT", "LEDG", "MLB", "CB", "FS", "K", "P"].map((p) => (
            <PositionBadge key={p} position={p} />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "team",
    name: "TeamLogo · TeamChip",
    note: "Monogram shields until Sprint 4 caches ESPN logos.",
    render: () => (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-x-5 gap-y-2">
          <TeamChip team={NE} label="full" record={formatRecord({ w: 14, l: 3 })} />
          <TeamChip team={BUF} record="9-8" />
          <TeamChip team={KC} label="abbr" size="xs" />
        </div>
        <div className="grid grid-cols-8 gap-2 @tablet:grid-cols-16">
          {NFL_TEAMS.map((t) => (
            <TeamLogo key={t.abbr} team={t} size="md" />
          ))}
        </div>
      </div>
    ),
  },
  {
    id: "teampicker",
    name: "TeamPicker",
    note: "Franchise setup's team choice: grouped by division, the pick shown in its colors.",
    render: () => <TeamPickerDemo />,
  },
  {
    id: "splitpane",
    name: "SplitPane",
    note: "Side by side when wide; a segmented control and swipe when narrow.",
    render: () => (
      <SplitPane
        ratio="3fr 2fr"
        panes={[
          {
            id: "box",
            label: "Box score",
            content: (
              <Section title="Box score" variant="card">
                <p className="text-sm text-muted-foreground">
                  Passing, rushing, receiving and defense tables live here.
                </p>
              </Section>
            ),
          },
          {
            id: "notes",
            label: "Notes",
            content: (
              <Section title="Notes" variant="card">
                <p className="text-sm text-muted-foreground">
                  Maye was surgical in the 4th. Diggs 5 straight 100-yard games.
                </p>
              </Section>
            ),
          },
        ]}
      />
    ),
  },
  {
    id: "emptystate",
    name: "EmptyState · Section",
    render: () => (
      <Section title="Box score" description="Week 7 vs Bills" actions={<Badge tone="warn">No data</Badge>}>
        <EmptyState
          icon={Inbox}
          title="No box score yet"
          description="Snap the box score screens and drop them in the inbox."
          action={
            <Button variant="primary">
              <Plus /> Import screenshot
            </Button>
          }
        />
      </Section>
    ),
  },
  {
    id: "controls",
    name: "Button · Badge · Segmented · BottomSheet",
    render: () => (
      <div className="space-y-4">
        <div className="flex flex-wrap gap-2">
          <Button variant="primary">Commit</Button>
          <Button>Secondary</Button>
          <Button variant="outline">Outline</Button>
          <Button variant="ghost">Ghost</Button>
          <Button variant="destructive">Reject</Button>
        </div>
        <div className="flex flex-wrap gap-1.5">
          {(["neutral", "accent", "solid", "win", "loss", "tie", "ot", "warn"] as const).map((tone) => (
            <Badge key={tone} tone={tone}>
              {tone}
            </Badge>
          ))}
        </div>
        <SegmentedDemo />
        <SheetDemo />
      </div>
    ),
  },
];

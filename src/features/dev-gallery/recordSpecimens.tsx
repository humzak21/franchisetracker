import { MilestoneTimeline } from "@/components/data/MilestoneTimeline";
import { RankedList } from "@/components/data/RankedList";
import type { Specimen } from "./specimens";

export const RECORD_SPECIMENS: Specimen[] = [
  {
    id: "rankedlist",
    name: "RankedList",
    note: "One titled list of ranked rows, first place lit. A row can be marked as the user's own, and a list that is not a ranking leaves the numbers off.",
    render: () => (
      <div className="@container">
        <div className="grid gap-3 @lg:grid-cols-2">
          <RankedList
            title="Passing yards"
            label="Passing yards league leaders"
            items={[
              { key: "1", rank: 1, name: "Josh Allen", detail: "BUF", value: "4,812" },
              { key: "2", rank: 2, name: "Drake Maye", detail: "NE · Tied", value: "4,700", marked: true },
              { key: "3", rank: 2, name: "Lamar Jackson", detail: "BAL · Tied", value: "4,700" },
              { key: "4", rank: 4, name: "A name long enough to need truncating on a phone", value: "4,288" },
            ]}
            footer="Set 2027 W9 vs MIA"
          />
          <RankedList
            title="Team"
            label="Longest team streaks"
            items={[
              { key: "wins", name: "Wins", detail: "2027 W3 to 2027 W11", value: 9 },
              { key: "home", name: "Home wins", detail: "2026 W2 to 2027 W4", value: 11 },
            ]}
          />
        </div>
      </div>
    ),
  },
  {
    id: "milestonetimeline",
    name: "MilestoneTimeline",
    note: "What happened and when, newest first; the date links to the game when there was one.",
    render: () => (
      <MilestoneTimeline
        items={[
          {
            key: "a",
            kind: "mark",
            title: "1,000 passing yards",
            detail: "Career · in 4 games · #1 fastest",
            when: "2027 W5",
          },
          { key: "b", kind: "career_high", title: "Career-high 3 passing touchdowns", when: "2027 W3" },
          { key: "c", kind: "player_streak", title: "5 straight, games with a TD pass", when: "2027 W2" },
        ]}
      />
    ),
  },
];

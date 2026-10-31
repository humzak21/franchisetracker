import { useState } from "react";
import { DEFAULT_QUESTION, type Question } from "@shared/stats";
import type { DataColumn } from "@/components/data/DataTable";
import { QuarterGrid } from "@/components/data/QuarterGrid";
import { QuestionBuilder } from "@/components/data/QuestionBuilder";
import { SplitTable } from "@/components/data/SplitTable";
import { CopyButton } from "@/components/ui/CopyButton";
import type { Specimen } from "./specimens";

type Group = { key: string; label: string; games: number; yards: number };

const groupColumns: DataColumn<Group>[] = [
  { id: "games", header: "G", align: "right", value: (g) => g.games },
  { id: "yards", header: "YDS", align: "right", value: (g) => g.yards },
];

function QuestionDemo() {
  const [question, setQuestion] = useState<Question>({ ...DEFAULT_QUESTION, scope: "span" });
  return (
    <QuestionBuilder
      question={question}
      onChange={setQuestion}
      years={[2026, 2027, 2028]}
      opponents={["BUF", "MIA", "NYJ"]}
      player={null}
    />
  );
}

export const EXPLORER_SPECIMENS: Specimen[] = [
  {
    id: "copybutton",
    name: "CopyButton",
    note: "Copies text and confirms it for a moment; on a phone the label goes to screen readers.",
    render: () => <CopyButton text="Week 9: W 31-24 vs Cowboys" label="Copy" />,
  },
  {
    id: "splittable",
    name: "SplitTable",
    note: "One kind of split at a time over a DataTable: a row per group, the caller's columns.",
    render: () => (
      <SplitTable
        id="gallery-splits"
        caption="Rushing yards by split"
        columns={groupColumns}
        primaryColumns={["games", "yards"]}
        sections={[
          {
            kind: "venue",
            label: "Home and away",
            groups: [
              { key: "home", label: "Home", games: 9, yards: 612 },
              { key: "away", label: "Away", games: 8, yards: 488 },
            ],
          },
          {
            kind: "outcome",
            label: "Result",
            groups: [
              { key: "wins", label: "Wins", games: 12, yards: 880 },
              { key: "losses", label: "Losses", games: 5, yards: 220 },
            ],
          },
        ]}
      />
    ),
  },
  {
    id: "quartergrid",
    name: "QuarterGrid",
    note: "Points for, against and the difference per period, a bar in each cell. Overtime adds a column.",
    render: () => (
      <QuarterGrid
        periods={[
          { period: 1, pointsFor: 84, pointsAgainst: 61, differential: 23 },
          { period: 2, pointsFor: 122, pointsAgainst: 98, differential: 24 },
          { period: 3, pointsFor: 70, pointsAgainst: 77, differential: -7 },
          { period: 4, pointsFor: 104, pointsAgainst: 104, differential: 0 },
          { period: 5, pointsFor: 6, pointsAgainst: 3, differential: 3 },
        ]}
      />
    ),
  },
  {
    id: "questionbuilder",
    name: "QuestionBuilder",
    note: "The explorer's controls in place on a wide screen; on a phone they open in a sheet behind a line saying what is being asked.",
    render: () => <QuestionDemo />,
  },
];

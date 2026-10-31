import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { describeQuestion, explorerValue, usesMinGames, type Question } from "@shared/stats";
import { RankedList } from "@/components/data/RankedList";
import { Segmented } from "@/components/ui/segmented";
import { useLocalStorage } from "@/lib/hooks/useLocalStorage";

type Answered = Extract<FunctionReturnType<typeof api.stats.explorer.run>, { status: "answered" }>;
type Shape = "list" | "bars";

const SHAPES: { value: Shape; label: string }[] = [
  { value: "list", label: "List" },
  { value: "bars", label: "Bars" },
];

/** The answer as a ranked list, with a bar per row when asked for a picture. */
export function ExplorerAnswer({
  question,
  rows,
  total,
  limit,
}: {
  question: Question;
  rows: Answered["rows"];
  total: number;
  limit: number;
}) {
  const [shape, setShape] = useLocalStorage<Shape>("ft.explorer-shape", "list");
  const largest = Math.max(...rows.map((r) => r.value));
  return (
    <div className="space-y-3">
      <Segmented size="sm" aria-label="Show as" value={shape} onChange={setShape} options={SHAPES} />
      <RankedList
        title={describeQuestion(question)}
        label="Explorer answer"
        items={rows.map((row) => ({
          key: row.key,
          rank: row.rank,
          name: row.player.name,
          playerId: row.player.playerId,
          detail: [
            row.player.position,
            row.when,
            usesMinGames(question.scope) && row.games !== null ? `${row.games} games` : null,
          ]
            .filter((part) => part !== null)
            .join(" · "),
          gameId: row.gameId ?? undefined,
          value: explorerValue(question, row.value),
          share: shape === "bars" ? row.value / largest : undefined,
        }))}
        footer={total > limit ? `The top ${limit} of ${total}.` : undefined}
      />
    </div>
  );
}

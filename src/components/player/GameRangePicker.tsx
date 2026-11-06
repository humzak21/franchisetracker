import { inRange, seasonsIn, type GamePoint, type GameRange } from "@shared/stats";
import { Select } from "@/components/ui/select";

const ALL = "all";
const CUSTOM = "custom";

function choiceOf(range: GameRange): string {
  if (range.kind === "season") return `season:${range.year}`;
  return range.kind === "span" ? CUSTOM : ALL;
}

/**
 * Which games the game-by-game chart covers: all of them, one season, or a span from one game to
 * another, across seasons if need be. A new span starts from whatever was showing.
 */
export function GameRangePicker({
  points,
  range,
  onChange,
}: {
  points: readonly GamePoint[];
  range: GameRange;
  onChange: (range: GameRange) => void;
}) {
  const pick = (choice: string) => {
    if (choice === ALL) return onChange({ kind: "all" });
    if (choice === CUSTOM) {
      const shown = inRange(points, range);
      const from = shown[0]?.key ?? points[0]?.key ?? "";
      const to = shown.at(-1)?.key ?? points.at(-1)?.key ?? "";
      return onChange({ kind: "span", from, to });
    }
    onChange({ kind: "season", year: Number(choice.slice("season:".length)) });
  };
  const games = points.map((p) => ({ value: p.key, label: p.label }));

  return (
    <div className="flex max-w-full flex-wrap items-center gap-2">
      <Select
        className="w-44"
        aria-label="Games to chart"
        value={choiceOf(range)}
        onValueChange={pick}
        options={[
          { value: ALL, label: "All games" },
          ...seasonsIn(points).map((year) => ({
            value: `season:${year}`,
            label: `${year} season`,
            group: "Season",
          })),
          { value: CUSTOM, label: "From… to…", group: "Weeks" },
        ]}
      />
      {range.kind === "span" && (
        <div className="flex min-w-0 items-center gap-2">
          <Select
            className="w-40"
            aria-label="From game"
            value={range.from}
            onValueChange={(from) => onChange({ ...range, from })}
            options={games}
          />
          <span className="text-sm text-muted-foreground">to</span>
          <Select
            className="w-40"
            aria-label="To game"
            value={range.to}
            onValueChange={(to) => onChange({ ...range, to })}
            options={games}
          />
        </div>
      )}
    </div>
  );
}

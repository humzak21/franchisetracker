import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { weekLabel } from "@shared/domain";
import { meetingBars } from "@shared/games/charts";
import { DivergingBars } from "@/components/data/DivergingBars";
import { ResultBadge } from "@/components/team/ResultBadge";

type HeadToHead = FunctionReturnType<typeof api.league.teamHistory.get>["headToHead"];

/** Every franchise game against one opponent: the margins as a chart, then each meeting linked. */
export function TeamHeadToHead({ headToHead }: { headToHead: HeadToHead }) {
  return (
    <div className="space-y-3">
      {headToHead.games.length > 1 && (
        <div className="rounded-xl border border-border bg-surface p-4">
          <DivergingBars
            points={meetingBars(headToHead.games.map((g) => ({ ...g, id: g.gameId })))}
            valueLabel="Margin in each meeting"
          />
        </div>
      )}
      <ul className="grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
        {headToHead.games.map((g) => (
          <li key={g.gameId}>
            <Link
              to="/games/$gameId"
              params={{ gameId: g.gameId }}
              className="flex min-h-12 items-center gap-3 rounded-xl border border-border bg-surface px-3 hover:bg-surface-2"
            >
              <ResultBadge result={g.result} us={g.us} them={g.them} />
              <span className="ml-auto text-sm text-muted-foreground">
                {g.year} · {weekLabel(g.weekKey)}
              </span>
            </Link>
          </li>
        ))}
      </ul>
    </div>
  );
}

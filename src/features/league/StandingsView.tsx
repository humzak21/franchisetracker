import { Trophy } from "lucide-react";
import type { ReactNode } from "react";
import { CONFERENCES } from "@shared/domain";
import { STANDING_DIVISIONS } from "@shared/league/alignment";
import { cn } from "@/lib/cn";
import { StandingRow } from "./StandingRow";
import { TeamLink } from "./TeamLink";
import type { Board, BoardRow } from "./types";

export type StandingsMode = "divisions" | "conference";

function Card({ title, children }: { title: string; children: ReactNode }) {
  return (
    <section className="overflow-hidden rounded-xl border border-border bg-surface" aria-label={title}>
      <h3 className="border-b border-border px-3 py-2 font-display text-base font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <ol>{children}</ol>
    </section>
  );
}

function Champions({ rows }: { rows: BoardRow[] }) {
  const reached = (conference: string) =>
    rows.find(
      (r) => r.conference === conference && (r.playoffResult === "sb_loss" || r.playoffResult === "champion"),
    )?.team;
  const winners = (
    [
      ["AFC champion", reached("AFC")],
      ["NFC champion", reached("NFC")],
      ["Super Bowl", rows.find((r) => r.playoffResult === "champion")?.team],
    ] as const
  ).flatMap(([label, team]) => (team ? [{ label, team }] : []));
  if (winners.length === 0) return null;
  return (
    <ul className="grid gap-2 @tablet:grid-cols-3" aria-label="Champions">
      {winners.map(({ label, team }) => (
        <li
          key={label}
          className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
        >
          <Trophy className="size-5 shrink-0 text-primary" />
          <span className="min-w-0">
            <span className="block text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {label}
            </span>
            <TeamLink team={team} label="full" size="xs" />
          </span>
        </li>
      ))}
    </ul>
  );
}

/**
 * A season's standings (FEATURES.md 5.6): division by division, or each conference in seed
 * order. Bye seeds read green and wild cards orange, projected until the regular season ends.
 */
export function StandingsView({ board, mode }: { board: Board; mode: StandingsMode }) {
  const conferences = CONFERENCES.map((conference) => ({
    conference,
    rows: board.rows.filter((r) => r.conference === conference),
  })).filter((c) => c.rows.length > 0);

  return (
    <div className="space-y-5">
      <Champions rows={board.rows} />
      {mode === "conference" ? (
        <div className="grid gap-3 @desktop:grid-cols-2">
          {conferences.map(({ conference, rows }) => (
            <Card key={conference} title={conference}>
              {[...rows]
                .sort((a, b) => a.conferenceRank - b.conferenceRank)
                .map((r) => (
                  <StandingRow
                    key={r.team._id}
                    row={r}
                    place={r.conferenceRank}
                    byeSeeds={board.byeSeeds}
                    detail={r.division}
                  />
                ))}
            </Card>
          ))}
        </div>
      ) : (
        conferences.map(({ conference, rows }) => {
          const divisions = STANDING_DIVISIONS.filter((d) => rows.some((r) => r.division === d));
          return (
            <div key={conference} className="space-y-2">
              <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                {conference}
              </h3>
              {/* Three divisions a conference before the 2002 realignment, four since. */}
              <div
                className={cn(
                  "grid gap-3 @tablet:grid-cols-2",
                  divisions.length === 3 ? "@desktop:grid-cols-3" : "@desktop:grid-cols-4",
                )}
              >
                {divisions.map((division) => (
                  <Card key={division} title={`${conference} ${division}`}>
                    {rows
                      .filter((r) => r.division === division)
                      .sort((a, b) => a.divisionRank - b.divisionRank)
                      .map((r) => (
                        <StandingRow
                          key={r.team._id}
                          row={r}
                          place={r.divisionRank}
                          byeSeeds={board.byeSeeds}
                        />
                      ))}
                  </Card>
                ))}
              </div>
            </div>
          );
        })
      )}
    </div>
  );
}

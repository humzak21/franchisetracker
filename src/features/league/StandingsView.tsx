import { ListOrdered, Trophy } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { championsOf, groupStandings } from "@shared/league/standings";
import { formatRecord } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { Badge, Skeleton } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import { TeamLink } from "./TeamLink";
import { toRow, type Standing } from "./types";
import { useQuery } from "@/lib/convex/useQuery";

function DivisionCard({ title, rows, userAbbr }: { title: string; rows: Standing[]; userAbbr?: string }) {
  return (
    <section className="rounded-xl border border-border bg-surface" aria-label={title}>
      <h3 className="border-b border-border px-3 py-2 font-display text-base font-semibold tracking-wide uppercase">
        {title}
      </h3>
      <ol>
        {rows.map((r, i) => (
          <li
            key={r.team._id}
            className={cn(
              "flex min-h-12 items-center gap-2 border-b border-border px-3 py-1.5 last:border-b-0",
              r.team.abbr === userAbbr && "bg-elite-1",
            )}
          >
            <span className="num w-4 text-xs text-subtle-foreground">{r.divisionRank ?? i + 1}</span>
            <TeamLink team={r.team} label="name" size="xs" className="flex-1" />
            {r.seed !== undefined && (
              <Badge tone={r.seed <= 4 ? "solid" : "accent"} title={`Playoff seed ${r.seed}`}>
                {r.seed}
              </Badge>
            )}
            <span className="num w-14 text-right text-sm font-semibold">{formatRecord(r)}</span>
            {r.pointsFor !== undefined && (
              <span className="num hidden w-16 text-right text-xs text-muted-foreground @sm:inline">
                {r.pointsFor}–{r.pointsAgainst ?? "?"}
              </span>
            )}
          </li>
        ))}
      </ol>
    </section>
  );
}

/**
 * A season's standings (FEATURES.md 5.6): division cards with seed badges, conference by
 * conference, and who won the conferences and the Super Bowl once the season is decided.
 */
export function StandingsView({ seasonId }: { seasonId: Id<"seasons"> }) {
  const rows = useQuery(api.league.standings.bySeason, { seasonId });
  const userAbbr = useFranchise()?.userTeam.abbr;
  if (rows === undefined) return <Skeleton className="h-80 rounded-xl" />;
  if (rows.length === 0) {
    return (
      <EmptyState
        icon={ListOrdered}
        title="No standings for this season yet"
        description="Capture the standings screen at the end of the season; real NFL seasons import on their own."
      />
    );
  }
  const shared = rows.map(toRow);
  const champs = championsOf(shared);
  const team = (abbr: string | null) => rows.find((r) => r.team.abbr === abbr)?.team;
  const winners = (
    [
      ["AFC champion", team(champs.afc)],
      ["NFC champion", team(champs.nfc)],
      ["Super Bowl", team(champs.superBowl)],
    ] as const
  ).filter(([, t]) => t);

  return (
    <div className="@container space-y-6">
      {winners.length > 0 && (
        <ul className="grid gap-2 @tablet:grid-cols-3" aria-label="Champions">
          {winners.map(([label, t]) => (
            <li
              key={label}
              className="flex items-center gap-3 rounded-xl border border-border bg-surface px-3 py-2.5"
            >
              <Trophy className="size-5 shrink-0 text-primary" />
              <span className="min-w-0">
                <span className="block text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                  {label}
                </span>
                <TeamLink team={t!} label="full" size="xs" />
              </span>
            </li>
          ))}
        </ul>
      )}
      {groupStandings(shared).map(({ conference, divisions }) => (
        <Section key={conference} title={conference}>
          <div className="grid gap-3 @tablet:grid-cols-2 @desktop:grid-cols-4">
            {divisions.map(({ division, rows: inDivision }) => (
              <DivisionCard
                key={division}
                title={`${conference} ${division}`}
                rows={inDivision.map((r) => r.standing)}
                userAbbr={userAbbr}
              />
            ))}
          </div>
        </Section>
      ))}
    </div>
  );
}

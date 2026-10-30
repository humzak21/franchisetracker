import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import { ArrowLeftRight } from "lucide-react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useSeason } from "@/app/season";
import { DeltaBadge } from "@/components/data/DeltaBadge";
import { EmptyState } from "@/components/data/EmptyState";
import { Section } from "@/components/layout/Section";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { TeamLike } from "@/components/team/TeamLogo";
import { Badge, Skeleton } from "@/components/ui/misc";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";

type Row = FunctionReturnType<typeof api.players.rosterDiff.between>["arrivals"][number];

function PlayerRow({ row, team, end }: { row: Row; team: TeamLike; end: ReactNode }) {
  return (
    <li className="flex min-h-12 items-center gap-3 px-3 py-1.5">
      <Link
        to="/players/$playerId"
        params={{ playerId: row.playerId }}
        className="min-w-0 flex-1 rounded-md hover:text-primary"
      >
        <PlayerChip size="sm" player={{ ...row, team }} />
      </Link>
      {end}
    </li>
  );
}

function Group({ title, count, children }: { title: string; count: number; children: ReactNode }) {
  return (
    <Section title={`${title} · ${count}`}>
      {count === 0 ? (
        <p className="text-sm text-muted-foreground">None.</p>
      ) : (
        <ul className="divide-y divide-border overflow-hidden rounded-xl border border-border bg-surface">
          {children}
        </ul>
      )}
    </Section>
  );
}

/** The roster diff (FEATURES.md 5.3): this season against any other, last year by default. */
export function RosterChanges({
  teamId,
  team,
  season,
  startYear,
}: {
  teamId: Id<"teams">;
  team: TeamLike;
  season: { _id: Id<"seasons">; year: number };
  startYear: number;
}) {
  const { seasons } = useSeason();
  const others = seasons
    .filter((s) => s.year >= startYear && s._id !== season._id)
    .sort((a, b) => b.year - a.year);
  const [picked, setPicked] = useState<Id<"seasons"> | null>(null);
  const other = others.find((s) => s._id === picked) ?? others.find((s) => s.year < season.year) ?? others[0];
  // Earlier to later whichever way round they were picked, so an arrival is always someone who joined.
  const [from, to] = other && other.year > season.year ? [season, other] : [other, season];
  const diff = useQuery(
    api.players.rosterDiff.between,
    from ? { teamId, fromSeasonId: from._id, toSeasonId: to._id } : "skip",
  );
  if (!other) {
    return (
      <EmptyState
        icon={ArrowLeftRight}
        title="Nothing to compare yet"
        description="A second season gives this roster something to compare against."
      />
    );
  }

  return (
    <div className="space-y-6">
      <label className="flex flex-wrap items-center gap-2 text-sm text-muted-foreground">
        {season.year} compared with
        <Select
          className="w-28"
          aria-label="Compare with season"
          value={other._id}
          options={others.map((s) => ({ value: s._id, label: String(s.year) }))}
          onValueChange={(id) => setPicked(id as Id<"seasons">)}
        />
      </label>
      {diff === undefined ? (
        <Skeleton className="h-64 rounded-xl" />
      ) : (
        <div className="@container">
          <div className="grid grid-cols-1 items-start gap-6 @desktop:grid-cols-3">
            <Group title="Arrivals" count={diff.arrivals.length}>
              {diff.arrivals.map((r) => (
                <PlayerRow
                  key={r.playerId}
                  row={r}
                  team={team}
                  end={<Badge className="num">{r.ovr ?? "—"}</Badge>}
                />
              ))}
            </Group>
            <Group title="Departures" count={diff.departures.length}>
              {diff.departures.map((r) => (
                <PlayerRow
                  key={r.playerId}
                  row={r}
                  team={team}
                  end={<Badge className="num">{r.ovr ?? "—"}</Badge>}
                />
              ))}
            </Group>
            <Group title="OVR changes" count={diff.changes.length}>
              {diff.changes.map((c) => (
                <PlayerRow
                  key={c.after.playerId}
                  row={c.after}
                  team={team}
                  end={
                    <span className="flex items-center gap-2">
                      <span className="num text-xs text-muted-foreground">
                        {c.before.ovr} → {c.after.ovr}
                      </span>
                      <DeltaBadge delta={c.delta} />
                    </span>
                  }
                />
              ))}
            </Group>
          </div>
        </div>
      )}
    </div>
  );
}

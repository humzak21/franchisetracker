import { Link } from "@tanstack/react-router";
import { formatRecord, formatSigned, formatStat, STAT_REGISTRY } from "@shared/stats";
import { useFranchise } from "@/app/franchise";
import { Tile } from "@/components/data/Tile";
import { PlayerChip } from "@/components/player/PlayerChip";
import type { SeasonReportData } from "./types";

/** The computed season beside the written report: record, points, streak and the team's leaders. */
export function SeasonSummaryPanel({ data }: { data: SeasonReportData }) {
  const { summary, leaders } = data;
  const userTeam = useFranchise()?.userTeam;
  const post = summary.postseason;
  return (
    <div className="space-y-3">
      <div className="grid grid-cols-2 gap-2">
        <Tile
          label="Record"
          value={formatRecord(summary.regular)}
          accent
          detail={`${summary.played} games played`}
        />
        <Tile label="Playoffs" value={post.w + post.l > 0 ? formatRecord(post) : "—"} />
        <Tile
          label="Points"
          value={formatSigned(summary.pointsFor - summary.pointsAgainst)}
          detail={`${summary.pointsFor} for, ${summary.pointsAgainst} against`}
        />
        <Tile label="Streak" value={summary.streak ?? "—"} detail="At the end" />
      </div>
      <div className="rounded-xl border border-border bg-surface p-4">
        <h3 className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
          Team leaders
        </h3>
        {leaders.length === 0 ? (
          <p className="mt-2 text-sm text-muted-foreground">Leaders appear once box scores are captured.</p>
        ) : (
          <ul className="mt-2 divide-y divide-border">
            {leaders.map((leader) => (
              <li key={leader.stat} className="flex min-h-12 items-center gap-3">
                <Link
                  to="/players/$playerId"
                  params={{ playerId: leader.player._id }}
                  className="min-w-0 flex-1"
                >
                  <PlayerChip
                    player={{ ...leader.player, team: userTeam }}
                    size="sm"
                    caption={STAT_REGISTRY[leader.stat].label}
                  />
                </Link>
                <span className="num font-display text-xl font-bold">
                  {formatStat(leader.stat, leader.value)}
                </span>
              </li>
            ))}
          </ul>
        )}
      </div>
    </div>
  );
}

import { UserMinus } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import type { RowsDraft } from "@shared/ingestion/rows/types";
import { MIN_WHOLE_ROSTER } from "@shared/roster/rosterPage";
import { Notice } from "@/components/data/Notice";
import { Section } from "@/components/layout/Section";
import { PositionBadge } from "@/components/player/PositionBadge";
import { useQuery } from "@/lib/convex/useQuery";
import { useReviewDraft } from "./reviewDraft";

/**
 * What committing this roster page will do to the team: a whole page releases anyone it does not
 * list, so they are named here first. A row that resolved to the wrong player shows up here too.
 */
export function RosterPagePreview({ draft }: { draft: RowsDraft<Id<"players">> }) {
  const { seasonId } = useReviewDraft();
  const teams = useQuery(api.league.teams.list, {});
  const team = teams?.find((t) => t.abbr === draft.meta.team);
  const accepted = draft.rows.filter((r) => r.accepted);
  const partial = draft.meta.partial === true;
  const preview = useQuery(
    api.players.rosterSync.preview,
    seasonId && team
      ? {
          seasonId,
          teamId: team._id,
          playerIds: accepted.flatMap((r) => (r.playerId ? [r.playerId] : [])),
          rows: accepted.length,
          partial,
        }
      : "skip",
  );
  if (!preview) return null;
  if (!preview.whole) {
    return (
      <Notice icon={UserMinus}>
        {partial
          ? "Marked as part of the roster, so nobody is released."
          : `Under ${MIN_WHOLE_ROSTER} rows is not a whole roster, so nobody is released.`}
      </Notice>
    );
  }
  if (preview.leaving.length === 0) return null;
  return (
    <Section
      title={`Not on this page · ${preview.leaving.length}`}
      description={`Committing releases them from the ${team?.name ?? ""} roster. If the page only shows part of it, say so above.`}
      variant="card"
    >
      <ul className="grid gap-x-4 gap-y-1 sm:grid-cols-2">
        {preview.leaving.map((p) => (
          <li key={p.playerId} className="flex min-h-8 items-center gap-2 text-sm">
            <PositionBadge position={p.position} />
            <span className="min-w-0 flex-1 truncate">{p.displayName}</span>
            <span className="num text-xs text-muted-foreground">{p.ovr ?? "—"}</span>
          </li>
        ))}
      </ul>
    </Section>
  );
}

import { useMutation } from "convex/react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { useSeason } from "@/app/season";
import { MovePlayerSheet } from "@/components/player/MovePlayerSheet";
import { useQuery } from "@/lib/convex/useQuery";
import type { RosterRow } from "./rosterColumns";

/** "Move…" from a roster row: starts from this season, this team and his status on it. */
export function RosterMoveSheet({ row, onClose }: { row: RosterRow | null; onClose: () => void }) {
  const move = useMutation(api.players.move.move);
  const teams = useQuery(api.league.teams.list, {});
  const { seasons } = useSeason();
  if (!row) return null;
  return (
    <MovePlayerSheet
      key={row.entry._id}
      open
      onOpenChange={(open) => !open && onClose()}
      name={row.player.displayName}
      seasons={seasons.map((s) => ({ value: s._id, label: String(s.year) }))}
      teams={(teams ?? []).map((t) => ({ value: t._id, label: `${t.city} ${t.name}` }))}
      initial={{ seasonId: row.entry.seasonId, teamId: row.entry.teamId, status: row.entry.status }}
      onMove={(values) =>
        move({
          playerId: row.player._id,
          seasonId: values.seasonId as Id<"seasons">,
          teamId: values.teamId as Id<"teams">,
          status: values.status,
          statusWeekKey: values.statusWeekKey,
          leaving: values.leaving,
        })
      }
    />
  );
}

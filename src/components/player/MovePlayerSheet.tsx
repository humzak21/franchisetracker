import { useState, type FormEvent } from "react";
import { ROSTER_STATUS_LABELS, WEEK_KEYS, weekLabel, type RosterStatus, type WeekKey } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Segmented } from "@/components/ui/segmented";
import { Select, type SelectOption } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";

/** Statuses a player can be moved into; "traded" marks the entry he leaves. */
const STATUSES = ["active", "ir", "practice_squad", "released"] as const satisfies readonly RosterStatus[];
const NO_WEEK = "none";
const label = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

export type MoveValues = {
  seasonId: string;
  teamId: string;
  status: (typeof STATUSES)[number];
  statusWeekKey?: WeekKey;
  leaving: "traded" | "released";
};

type MovePlayerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  name: string;
  seasons: readonly SelectOption[];
  teams: readonly SelectOption[];
  /** Where he is now: the season, his team that season and his status there. */
  initial: { seasonId: string; teamId: string; status: RosterStatus };
  onMove: (values: MoveValues) => Promise<unknown>;
};

/**
 * Moves a player by hand, without logging a transaction: onto another team for a season, or to
 * IR, the practice squad or released with his team. Remount it (a `key`) to start from `initial`.
 */
export function MovePlayerSheet({
  open,
  onOpenChange,
  name,
  seasons,
  teams,
  initial,
  onMove,
}: MovePlayerSheetProps) {
  const [seasonId, setSeasonId] = useState(initial.seasonId);
  const [teamId, setTeamId] = useState(initial.teamId);
  const [status, setStatus] = useState<MoveValues["status"]>(
    initial.status === "traded" || initial.status === "unsigned" ? "active" : initial.status,
  );
  const [week, setWeek] = useState<string>(NO_WEEK);
  const [leaving, setLeaving] = useState<MoveValues["leaving"]>("traded");
  const [error, setError] = useState<string | null>(null);
  const [saving, setSaving] = useState(false);
  const changesTeam = teamId !== initial.teamId;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    setSaving(true);
    try {
      await onMove({
        seasonId,
        teamId,
        status,
        statusWeekKey: week === NO_WEEK ? undefined : (week as WeekKey),
        leaving,
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not moved. Try again."));
    } finally {
      setSaving(false);
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`Move ${name}`}
      description="Changes the roster directly; nothing is logged as a transaction."
    >
      <form onSubmit={submit} className="space-y-4 pb-1">
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className={label}>Season</span>
            <Select aria-label="Season" value={seasonId} onValueChange={setSeasonId} options={seasons} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Team</span>
            <Select aria-label="Team" value={teamId} onValueChange={setTeamId} options={teams} />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Status</span>
            <Select
              aria-label="Status"
              value={status}
              onValueChange={(s) => setStatus(s as MoveValues["status"])}
              options={STATUSES.map((s) => ({ value: s, label: ROSTER_STATUS_LABELS[s] }))}
            />
          </label>
          <label className="space-y-1.5">
            <span className={label}>As of</span>
            <Select
              aria-label="As of week"
              value={week}
              onValueChange={setWeek}
              options={[
                { value: NO_WEEK, label: "No week" },
                ...WEEK_KEYS.map((w) => ({ value: w, label: weekLabel(w, "long") })),
              ]}
            />
          </label>
        </div>
        {changesTeam && (
          <div className="space-y-1.5">
            <span className={label}>His old team</span>
            <Segmented
              size="sm"
              aria-label="His old team"
              value={leaving}
              onChange={setLeaving}
              options={[
                { value: "traded", label: "Traded him" },
                { value: "released", label: "Released him" },
              ]}
            />
          </div>
        )}
        {error && <p className="text-sm text-loss">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={saving}>
            Move
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

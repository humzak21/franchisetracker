import { useMutation } from "convex/react";
import { TrendingUp, X } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { WEEK_KEYS, weekLabel, weekPhase, type WeekKey } from "@shared/domain";
import { currentSeason, useFranchise } from "@/app/franchise";
import { EmptyState } from "@/components/data/EmptyState";
import { TrendChart } from "@/components/data/TrendChart";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { useQuery } from "@/lib/convex/useQuery";

const WEEKS = WEEK_KEYS.filter((w) => weekPhase(w) === "regular" || weekPhase(w) === "postseason").map(
  (w) => ({
    value: w,
    label: weekLabel(w, "long"),
  }),
);

/** Logs an in-season OVR checkpoint for the franchise's current season. */
function LogOvr({ playerId, seasonId }: { playerId: Id<"players">; seasonId: Id<"seasons"> }) {
  const save = useMutation(api.players.progression.saveSnapshot);
  const [week, setWeek] = useState<WeekKey>("w1");
  const [ovr, setOvr] = useState("");
  const [error, setError] = useState<string | null>(null);
  const submit = async () => {
    setError(null);
    try {
      await save({ playerId, seasonId, weekKey: week, ovr: Number(ovr) });
      setOvr("");
    } catch (e) {
      setError(errorMessage(e, "Could not save the rating"));
    }
  };
  return (
    <form
      className="flex flex-wrap items-end gap-2"
      onSubmit={(e) => {
        e.preventDefault();
        void submit();
      }}
    >
      <label className="min-w-36 flex-1 text-xs text-muted-foreground">
        Week
        <Select className="mt-1" value={week} onValueChange={(w) => setWeek(w as WeekKey)} options={WEEKS} />
      </label>
      <label className="w-24 text-xs text-muted-foreground">
        OVR
        <Input
          className="num mt-1"
          inputMode="numeric"
          value={ovr}
          onChange={(e) => setOvr(e.target.value.replace(/\D/g, "").slice(0, 2))}
          aria-label="OVR"
        />
      </label>
      <Button type="submit" variant="primary" disabled={ovr === ""}>
        Log OVR
      </Button>
      {error && <p className="w-full text-sm text-loss">{error}</p>}
    </form>
  );
}

/** OVR across seasons (roster entries) and within them (snapshots), with a way to log the next one. */
export function OvrProgression({ playerId }: { playerId: Id<"players"> }) {
  const points = useQuery(api.players.progression.ovr, { playerId });
  const remove = useMutation(api.players.progression.removeSnapshot);
  const season = currentSeason(useFranchise()?.seasons ?? []);
  if (points === undefined) return <Skeleton className="h-60 rounded-xl" />;

  const snapshots = points.flatMap((p) =>
    p.snapshotId && p.seasonId === season?._id ? [{ ...p, snapshotId: p.snapshotId }] : [],
  );
  const [only] = points;
  return (
    <div className="space-y-4 rounded-xl border border-border bg-surface p-4">
      {points.length >= 2 ? (
        <TrendChart
          valueLabel="OVR"
          points={points.map((p) => ({
            key: `${p.seasonId}-${p.weekKey ?? "season"}`,
            label: `${p.year} · ${p.weekKey ? weekLabel(p.weekKey, "long") : "Roster"}`,
            group: String(p.year),
            value: p.ovr,
          }))}
        />
      ) : (
        <EmptyState
          icon={TrendingUp}
          title={only ? `OVR ${only.ovr} in ${only.year}` : "No ratings yet"}
          description="Each season's roster rating and the checkpoints you log during it draw the progression line."
        />
      )}
      {snapshots.length > 0 && (
        <ul className="flex flex-wrap gap-1.5" aria-label="This season's checkpoints">
          {snapshots.map((p) => (
            <li
              key={p.snapshotId}
              className="num inline-flex items-center gap-1 rounded-md bg-surface-2 py-1 pr-1 pl-2 text-xs"
            >
              {p.weekKey ? weekLabel(p.weekKey) : ""} · {p.ovr}
              <button
                type="button"
                aria-label={`Remove ${p.weekKey ? weekLabel(p.weekKey, "long") : ""} checkpoint`}
                onClick={() => void remove({ snapshotId: p.snapshotId })}
                className="grid size-6 place-items-center rounded text-muted-foreground hover:bg-surface-3 hover:text-foreground pointer-coarse:size-9"
              >
                <X className="size-3.5" />
              </button>
            </li>
          ))}
        </ul>
      )}
      {season && <LogOvr playerId={playerId} seasonId={season._id} />}
    </div>
  );
}

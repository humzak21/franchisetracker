import { useMutation } from "convex/react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { DEV_TRAIT_LABELS, DEV_TRAITS, type DevTrait } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import type { HistoryRow } from "./types";

const TRAITS = DEV_TRAITS.map((t) => ({ value: t, label: DEV_TRAIT_LABELS[t] }));

/** OVR, dev trait and abilities on one season's roster entry (they change season to season). */
export function RatingsSheet({
  row,
  open,
  onOpenChange,
}: {
  row: HistoryRow;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useMutation(api.players.roster.updateEntry);
  const [ovr, setOvr] = useState(row.entry.ovr?.toString() ?? "");
  const [trait, setTrait] = useState<DevTrait>(row.entry.devTrait ?? "normal");
  const [abilities, setAbilities] = useState((row.entry.abilities ?? []).join(", "));
  const [error, setError] = useState<string | null>(null);

  const save = async () => {
    setError(null);
    try {
      await update({
        entryId: row.entry._id,
        patch: { ovr: ovr === "" ? null : Number(ovr), devTrait: trait, abilities: abilities.split(",") },
      });
      onOpenChange(false);
    } catch (e) {
      setError(errorMessage(e, "Could not save the ratings"));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${row.year} ratings`}
      description={`${row.team.abbr} roster entry`}
      footer={
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button variant="primary" onClick={() => void save()}>
            Save
          </Button>
        </div>
      }
    >
      <div className="grid gap-3 pb-1">
        <label className="text-sm">
          <span className="text-muted-foreground">OVR</span>
          <Input
            className="num mt-1"
            inputMode="numeric"
            value={ovr}
            onChange={(e) => setOvr(e.target.value.replace(/\D/g, "").slice(0, 2))}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Dev trait</span>
          <Select
            className="mt-1"
            value={trait}
            onValueChange={(t) => setTrait(t as DevTrait)}
            options={TRAITS}
          />
        </label>
        <label className="text-sm">
          <span className="text-muted-foreground">Abilities, comma separated</span>
          <Input
            className="mt-1"
            value={abilities}
            onChange={(e) => setAbilities(e.target.value)}
            placeholder="Gunslinger, Fearless"
          />
        </label>
        {error && <p className="text-sm text-loss">{error}</p>}
      </div>
    </BottomSheet>
  );
}

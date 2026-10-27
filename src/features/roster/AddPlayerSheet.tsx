import { useMutation } from "convex/react";
import { useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import {
  ACQUISITION_LABELS,
  ACQUISITION_TYPES,
  DEV_TRAIT_LABELS,
  DEV_TRAITS,
  POSITIONS,
  type AcquisitionType,
  type DevTrait,
  type Position,
} from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";

const label = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";
const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);
const numberOrUndefined = (s: string) => (s === "" ? undefined : Number(s));

type AddPlayerSheetProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  season: { _id: Id<"seasons">; year: number };
  teamId: Id<"teams">;
};

/** A new player, real or created, straight onto a team's roster for the season on screen. */
export function AddPlayerSheet({ open, onOpenChange, season, teamId: initialTeam }: AddPlayerSheetProps) {
  const create = useMutation(api.players.create.create);
  const teams = useQuery(api.league.teams.list, {});
  const [name, setName] = useState("");
  const [position, setPosition] = useState<Position>("QB");
  const [real, setReal] = useState<"real" | "fictional">("fictional");
  const [teamId, setTeamId] = useState<string>(initialTeam);
  const [nums, setNums] = useState({ jersey: "", ovr: "", age: "", exp: "" });
  const [trait, setTrait] = useState<DevTrait>("normal");
  const [acquired, setAcquired] = useState<AcquisitionType>("free_agent");
  const [college, setCollege] = useState("");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await create({
        displayName: name,
        position,
        isReal: real === "real",
        bio: college.trim() ? { college } : undefined,
        entry: {
          seasonId: season._id,
          teamId: teamId as Id<"teams">,
          patch: {
            jersey: numberOrUndefined(nums.jersey),
            ovr: numberOrUndefined(nums.ovr),
            age: numberOrUndefined(nums.age),
            exp: numberOrUndefined(nums.exp),
            devTrait: trait,
            acquisitionType: acquired,
            acquisitionYear: season.year,
          },
        },
      });
      setName("");
      setNums({ jersey: "", ovr: "", age: "", exp: "" });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not added. Try again."));
    }
  };

  const num = (key: keyof typeof nums, text: string, max: number) => (
    <label className="space-y-1.5">
      <span className={label}>{text}</span>
      <Input
        inputMode="numeric"
        value={nums[key]}
        onChange={(e) => setNums((n) => ({ ...n, [key]: digits(e.target.value, max) }))}
      />
    </label>
  );

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Add player"
      description={`Onto the ${season.year} roster. Everything can be edited later.`}
    >
      <form onSubmit={submit} className="space-y-4 pb-1">
        <label className="block space-y-1.5">
          <span className={label}>Name</span>
          <Input
            value={name}
            maxLength={60}
            onChange={(e) => setName(e.target.value)}
            placeholder="First Last"
          />
        </label>
        <div className="grid grid-cols-2 gap-3">
          <label className="space-y-1.5">
            <span className={label}>Position</span>
            <Select
              aria-label="Position"
              value={position}
              onValueChange={(p) => setPosition(p as Position)}
              options={POSITIONS.map((p) => ({ value: p, label: p }))}
            />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Team</span>
            <Select
              aria-label="Team"
              value={teamId}
              onValueChange={setTeamId}
              options={(teams ?? []).map((t) => ({ value: t._id, label: `${t.city} ${t.name}` }))}
            />
          </label>
          {num("jersey", "Jersey", 2)}
          {num("ovr", "OVR", 2)}
          {num("age", "Age", 2)}
          {num("exp", "Experience", 2)}
          <label className="space-y-1.5">
            <span className={label}>Dev trait</span>
            <Select
              aria-label="Dev trait"
              value={trait}
              onValueChange={(t) => setTrait(t as DevTrait)}
              options={DEV_TRAITS.map((t) => ({ value: t, label: DEV_TRAIT_LABELS[t] }))}
            />
          </label>
          <label className="space-y-1.5">
            <span className={label}>Acquired</span>
            <Select
              aria-label="Acquired"
              value={acquired}
              onValueChange={(a) => setAcquired(a as AcquisitionType)}
              options={ACQUISITION_TYPES.map((a) => ({ value: a, label: ACQUISITION_LABELS[a] }))}
            />
          </label>
        </div>
        <label className="block space-y-1.5">
          <span className={label}>College</span>
          <Input value={college} maxLength={60} onChange={(e) => setCollege(e.target.value)} />
        </label>
        <Segmented
          size="sm"
          aria-label="Real or created"
          value={real}
          onChange={setReal}
          options={[
            { value: "fictional", label: "Created player" },
            { value: "real", label: "Real player" },
          ]}
        />
        {error && <p className="text-sm text-loss">{error}</p>}
        <div className="flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary" disabled={name.trim() === ""}>
            Add player
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

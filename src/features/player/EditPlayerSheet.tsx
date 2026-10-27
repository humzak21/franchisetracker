import { useMutation } from "convex/react";
import { ConvexError } from "convex/values";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { POSITIONS, type Position } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select, type SelectOption } from "@/components/ui/select";
import { errorMessage } from "@/lib/errors";
import { formFromPlayer, patchFromForm, type PlayerForm } from "./playerForm";
import type { PlayerPage } from "./types";

const label = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";
const NO_TEAM = "none";

type TextKey = { [K in keyof PlayerForm]: PlayerForm[K] extends string ? K : never }[keyof PlayerForm];

function Field({ text, children, wide }: { text: string; children: ReactNode; wide?: boolean }) {
  return (
    <label className={wide ? "col-span-2 space-y-1.5" : "space-y-1.5"}>
      <span className={label}>{text}</span>
      {children}
    </label>
  );
}

type EditPlayerSheetProps = {
  page: PlayerPage;
  teams: readonly SelectOption[];
  /** The season a typed age belongs to: his latest season. */
  anchorYear: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

/** Every fact about the player himself; season facts are edited in the roster history table. */
export function EditPlayerSheet({ page, teams, anchorYear, open, onOpenChange }: EditPlayerSheetProps) {
  const update = useMutation(api.players.player.update);
  const [original] = useState(() => formFromPlayer(page.player, anchorYear));
  const [form, setForm] = useState<PlayerForm>(original);
  const [error, setError] = useState<string | null>(null);
  const set = (key: TextKey, digits?: number) => (e: { target: { value: string } }) =>
    setForm((f) => ({
      ...f,
      [key]: digits ? e.target.value.replace(/\D/g, "").slice(0, digits) : e.target.value,
    }));
  const text = (key: TextKey, digits?: number) => (
    <Input
      value={form[key]}
      inputMode={digits ? "numeric" : undefined}
      onChange={set(key, digits)}
      maxLength={digits ? undefined : 60}
    />
  );
  const check = (key: "undrafted" | "retired", caption: string) => (
    <label className="flex min-h-11 items-center gap-3 text-sm">
      <input
        type="checkbox"
        checked={form[key]}
        onChange={(e) => setForm((f) => ({ ...f, [key]: e.target.checked }))}
        className="size-5 accent-[var(--color-primary)]"
      />
      {caption}
    </label>
  );

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      const patch = patchFromForm<Id<"teams">>(form, original, anchorYear);
      if (!patch.ok) throw new ConvexError({ code: "invalid", message: patch.error });
      await update({ playerId: page.player._id, patch: patch.fields });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title="Edit player"
      description={page.player.displayName}
    >
      <form onSubmit={submit} className="grid grid-cols-2 gap-3 pb-1">
        <Field text="First name">{text("firstName")}</Field>
        <Field text="Last name">{text("lastName")}</Field>
        <Field text="Display name" wide>
          {text("displayName")}
        </Field>
        <Field text="Position">
          <Select
            aria-label="Position"
            value={form.position}
            onValueChange={(p) => setForm((f) => ({ ...f, position: p as Position }))}
            options={POSITIONS.map((p) => ({ value: p, label: p }))}
          />
        </Field>
        <Field text="College">{text("college")}</Field>
        <Field text="Birth year">{text("birthYear", 4)}</Field>
        <Field text={`Age in ${anchorYear}`}>
          <Input
            value={form.age}
            inputMode="numeric"
            disabled={form.birthYear !== ""}
            onChange={set("age", 2)}
          />
        </Field>
        <Field text="Height (ft, in)">
          <span className="flex gap-2">
            <Input aria-label="Feet" value={form.feet} inputMode="numeric" onChange={set("feet", 1)} />
            <Input aria-label="Inches" value={form.inches} inputMode="numeric" onChange={set("inches", 2)} />
          </span>
        </Field>
        <Field text="Weight (lb)">{text("weight", 3)}</Field>
        <Field text="Draft year">{text("draftYear", 4)}</Field>
        <Field text="Round">{text("draftRound", 2)}</Field>
        <Field text="Pick">{text("draftPick", 3)}</Field>
        <Field text="Drafted by">
          <Select
            aria-label="Drafted by"
            value={form.draftTeamId || NO_TEAM}
            onValueChange={(t) => setForm((f) => ({ ...f, draftTeamId: t === NO_TEAM ? "" : t }))}
            options={[{ value: NO_TEAM, label: "Unknown" }, ...teams]}
          />
        </Field>
        {check("undrafted", "Undrafted")}
        {check("retired", "Retired")}
        {error && <p className="col-span-2 text-sm text-loss">{error}</p>}
        <div className="col-span-2 flex justify-end gap-2">
          <Button variant="ghost" onClick={() => onOpenChange(false)}>
            Cancel
          </Button>
          <Button type="submit" variant="primary">
            Save
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

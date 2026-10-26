import { useMutation } from "convex/react";
import { useId, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { DEFENSIVE_SCHEMES, OFFENSIVE_SCHEMES, STAFF_FIELDS, type CoachingStaff } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";

const SUGGESTIONS: Partial<Record<keyof CoachingStaff, readonly string[]>> = {
  offensiveScheme: OFFENSIVE_SCHEMES,
  defensiveScheme: DEFENSIVE_SCHEMES,
};

/** Head coach, coordinators and schemes for one season; schemes suggest Madden's own. */
export function StaffSheet({
  season,
  open,
  onOpenChange,
}: {
  season: Doc<"seasons">;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const update = useMutation(api.seasons.staff.update);
  const [staff, setStaff] = useState<CoachingStaff>(season.coaching ?? {});
  const [error, setError] = useState<string | null>(null);
  const listId = useId();

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await update({ seasonId: season._id, coaching: staff });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={`${season.year} staff`}
      description="Shown in the season header and the decade grid."
    >
      <form onSubmit={submit} className="space-y-3">
        {STAFF_FIELDS.map(({ key, label }) => (
          <label key={key} className="block space-y-1">
            <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
              {label}
            </span>
            <Input
              value={staff[key] ?? ""}
              maxLength={60}
              list={SUGGESTIONS[key] ? `${listId}-${key}` : undefined}
              autoComplete="off"
              onChange={(e) => setStaff((s) => ({ ...s, [key]: e.target.value }))}
            />
            {SUGGESTIONS[key] && (
              <datalist id={`${listId}-${key}`}>
                {SUGGESTIONS[key].map((option) => (
                  <option key={option} value={option} />
                ))}
              </datalist>
            )}
          </label>
        ))}
        {error && <p className="text-sm text-loss">{error}</p>}
        <Button type="submit" variant="primary" className="w-full">
          Save staff
        </Button>
      </form>
    </BottomSheet>
  );
}

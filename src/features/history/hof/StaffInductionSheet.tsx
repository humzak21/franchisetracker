import { useMutation } from "convex/react";
import { Trash2 } from "lucide-react";
import { useState, type FormEvent, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Doc } from "@convex/_generated/dataModel";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { errorMessage } from "@/lib/errors";
import { Textarea } from "@/components/ui/textarea";

const digits = (s: string, max: number) => s.replace(/\D/g, "").slice(0, max);
const num = (s: string) => (s === "" ? undefined : Number(s));

function Field({ label, children }: { label: string; children: ReactNode }) {
  return (
    <label className="block min-w-0 space-y-1">
      <span className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {label}
      </span>
      {children}
    </label>
  );
}

/** Inducts a coach or staff member, or edits one (`entry` given). Players are inducted from their page. */
export function StaffInductionSheet({
  entry,
  defaultYear,
  open,
  onOpenChange,
}: {
  entry?: Doc<"hofEntries">;
  defaultYear: number;
  open: boolean;
  onOpenChange: (open: boolean) => void;
}) {
  const save = useMutation(api.hof.entries.saveStaff);
  const remove = useMutation(api.hof.entries.remove);
  const [name, setName] = useState(entry?.staffName ?? "");
  const [role, setRole] = useState(entry?.role ?? "Head Coach");
  const [first, setFirst] = useState(entry?.firstYear ? String(entry.firstYear) : "");
  const [last, setLast] = useState(entry?.lastYear ? String(entry.lastYear) : "");
  const [inducted, setInducted] = useState(String(entry?.inductedYear ?? defaultYear));
  const [blurb, setBlurb] = useState(entry?.blurb ?? "");
  const [error, setError] = useState<string | null>(null);

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    setError(null);
    try {
      await save({
        entryId: entry?._id,
        staffName: name,
        role,
        firstYear: num(first),
        lastYear: num(last),
        inductedYear: Number(inducted),
        retiredNumber: false,
        blurb: blurb || undefined,
      });
      onOpenChange(false);
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={onOpenChange}
      title={entry ? `Edit ${entry.staffName ?? "inductee"}` : "Induct a coach"}
      description="Coaches and staff hang on the wall in team colors, without a number."
    >
      <form onSubmit={submit} className="space-y-3">
        <div className="grid grid-cols-2 gap-2">
          <Field label="Name">
            <Input value={name} maxLength={60} onChange={(e) => setName(e.target.value)} />
          </Field>
          <Field label="Title">
            <Input value={role} maxLength={60} onChange={(e) => setRole(e.target.value)} />
          </Field>
        </div>
        <div className="grid grid-cols-3 gap-2">
          <Field label="First year">
            <Input inputMode="numeric" value={first} onChange={(e) => setFirst(digits(e.target.value, 4))} />
          </Field>
          <Field label="Last year">
            <Input inputMode="numeric" value={last} onChange={(e) => setLast(digits(e.target.value, 4))} />
          </Field>
          <Field label="Inducted">
            <Input
              inputMode="numeric"
              value={inducted}
              onChange={(e) => setInducted(digits(e.target.value, 4))}
            />
          </Field>
        </div>
        <Field label="Blurb">
          <Textarea value={blurb} rows={4} maxLength={2000} onChange={(e) => setBlurb(e.target.value)} />
        </Field>
        {error && <p className="text-sm text-loss">{error}</p>}
        <div className="flex gap-2">
          {entry && (
            <Button
              variant="ghost"
              onClick={() => void remove({ entryId: entry._id }).then(() => onOpenChange(false))}
            >
              <Trash2 /> Remove
            </Button>
          )}
          <Button
            type="submit"
            variant="primary"
            className="ml-auto"
            disabled={!name.trim() || inducted.length !== 4}
          >
            {entry ? "Save" : "Induct"}
          </Button>
        </div>
      </form>
    </BottomSheet>
  );
}

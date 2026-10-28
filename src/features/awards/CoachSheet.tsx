import { useMutation } from "convex/react";
import { Search, Trash2, UserPlus } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { coachKey, searchCoaches, type BankCoach } from "@shared/domain";
import { BottomSheet } from "@/components/overlay/BottomSheet";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Select } from "@/components/ui/select";
import { useQuery } from "@/lib/convex/useQuery";
import { errorMessage } from "@/lib/errors";

type Picked = { name: string; isNew: boolean };

/**
 * Coach of the Year (FEATURES.md 5.8): a head coach from the bank of every NFL head coach since
 * 2015, a coach created here, or a new one typed in, which is created as the award is given.
 */
export function CoachSheet({
  seasonId,
  open,
  onClose,
}: {
  seasonId: Id<"seasons">;
  open: boolean;
  onClose: () => void;
}) {
  const created = useQuery(api.awards.coaches.list, open ? {} : "skip");
  const teams = useQuery(api.league.teams.list, open ? {} : "skip");
  const assign = useMutation(api.awards.assign.assignCoach);
  const remove = useMutation(api.awards.coaches.remove);
  const [text, setText] = useState("");
  const [picked, setPicked] = useState<Picked | null>(null);
  const [teamAbbr, setTeamAbbr] = useState("");
  const [error, setError] = useState<string | null>(null);

  const createdCoaches: BankCoach[] = (created ?? []).map((c) => ({
    name: c.name,
    teams: c.team ? [c.team.abbr] : [],
  }));
  const matches = searchCoaches(createdCoaches, text);
  const typed = text.trim();
  const exact = matches.some((c) => coachKey(c.name) === coachKey(typed));

  const pick = (coach: BankCoach, isNew = false) => {
    setPicked({ name: coach.name, isNew });
    // The team they coached most recently; any team can be chosen instead.
    setTeamAbbr(coach.teams.at(-1) ?? "");
    setError(null);
  };
  // Each opening starts afresh; resetting on close would flash the list while the sheet slides away.
  const [wasOpen, setWasOpen] = useState(open);
  if (open !== wasOpen) {
    setWasOpen(open);
    if (open) {
      setText("");
      setPicked(null);
      setError(null);
    }
  }
  const submit = async () => {
    if (!picked) return;
    setError(null);
    try {
      const teamId = teams?.find((t) => t.abbr === teamAbbr)?._id;
      await assign({ seasonId, name: picked.name, teamId });
      onClose();
    } catch (err) {
      setError(errorMessage(err, "Not saved. Try again."));
    }
  };

  return (
    <BottomSheet
      open={open}
      onOpenChange={(o) => !o && onClose()}
      title="Assign Coach of the Year"
      description="Every NFL head coach since 2015, plus the coaches you create."
      footer={
        picked && (
          <Button variant="primary" size="lg" className="w-full" onClick={() => void submit()}>
            {picked.isNew ? `Create ${picked.name} and assign` : `Assign ${picked.name}`}
          </Button>
        )
      }
    >
      <div className="space-y-4">
        {picked ? (
          <div className="space-y-3 rounded-xl border border-border bg-surface-2 p-3">
            <div className="flex items-center justify-between gap-2">
              <span className="min-w-0">
                <span className="block truncate font-medium">{picked.name}</span>
                <span className="text-xs text-muted-foreground">
                  {picked.isNew ? "New coach" : "Head coach"}
                </span>
              </span>
              <Button size="sm" variant="ghost" onClick={() => setPicked(null)}>
                Change
              </Button>
            </div>
            <Select
              aria-label="Team"
              value={teamAbbr}
              placeholder="Team this season"
              onValueChange={setTeamAbbr}
              options={(teams ?? [])
                .map((t) => ({ value: t.abbr, label: `${t.city} ${t.name}`, group: t.conference }))
                .sort((a, b) => a.group.localeCompare(b.group) || a.label.localeCompare(b.label))}
            />
          </div>
        ) : (
          <>
            <label className="relative block">
              <Search className="absolute top-1/2 left-3 size-4 -translate-y-1/2 text-subtle-foreground" />
              <Input
                value={text}
                onChange={(e) => setText(e.target.value)}
                placeholder="Search coaches or type a new name"
                className="pl-9"
                aria-label="Search coaches"
                maxLength={60}
              />
            </label>
            <ul aria-label="Coaches" className="space-y-1">
              {typed.length >= 2 && !exact && (
                <li>
                  <button
                    type="button"
                    onClick={() => pick({ name: typed, teams: [] }, true)}
                    className="flex min-h-12 w-full items-center gap-3 rounded-lg px-3 text-left text-primary hover:bg-surface-2"
                  >
                    <UserPlus className="size-4 shrink-0" />
                    <span className="truncate font-medium">Create “{typed}”</span>
                  </button>
                </li>
              )}
              {matches.map((coach) => {
                const mine = created?.find((c) => c.name === coach.name);
                return (
                  <li key={coach.name} className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => pick(coach)}
                      className="flex min-h-12 min-w-0 flex-1 items-center gap-3 rounded-lg px-3 text-left hover:bg-surface-2"
                    >
                      <span className="min-w-0 flex-1 truncate font-medium">{coach.name}</span>
                      <span className="num shrink-0 text-xs text-muted-foreground">
                        {mine ? "Created" : coach.teams.join(" · ")}
                      </span>
                    </button>
                    {mine && (
                      <Button
                        size="icon-sm"
                        variant="ghost"
                        aria-label={`Delete ${coach.name}`}
                        onClick={() => void remove({ coachId: mine._id })}
                      >
                        <Trash2 />
                      </Button>
                    )}
                  </li>
                );
              })}
            </ul>
          </>
        )}
        {error && <p className="text-sm text-loss">{error}</p>}
      </div>
    </BottomSheet>
  );
}

import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import type { Doc, Id } from "@convex/_generated/dataModel";
import { currentNflSeason, FIRST_SEASON_RANGE } from "@shared/domain";
import { TeamPicker } from "@/components/team/TeamPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { teamCssVars, useTheme } from "@/design/theme";
import { cn } from "@/lib/cn";
import { errorMessage } from "@/lib/errors";

export const labelClass = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

type FranchiseFormProps = {
  /** Renders above the fields with the picked team (or none yet). */
  header: (team: Doc<"teams"> | undefined) => ReactNode;
  /** Extra controls in the submit bar: sign out on first run, cancel otherwise. */
  actions: ReactNode;
  /** The submit bar sticks to the bottom of the viewport (first run, where no tab bar covers it). */
  stickyBar?: boolean;
  onCreated?: (franchiseId: Id<"franchises">) => void;
  className?: string;
};

/**
 * Name, team and first season (FEATURES.md 5.0). Creating makes the new franchise the active one
 * and starts its real NFL history import. The form takes on the picked team's colors as a preview.
 */
export function FranchiseForm({ header, actions, stickyBar, onCreated, className }: FranchiseFormProps) {
  const teams = useQuery(api.league.teams.list, {});
  const create = useMutation(api.franchise.setup.create);
  const { resolved } = useTheme();
  const [name, setName] = useState("");
  const [teamAbbr, setTeamAbbr] = useState<string | null>(null);
  const [startYear, setStartYear] = useState(String(currentNflSeason(new Date())));
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const team = teams?.find((t) => t.abbr === teamAbbr);
  const style = useMemo(() => (team ? teamCssVars(team, resolved) : undefined), [team, resolved]);
  const year = Number(startYear);
  const ready =
    name.trim() !== "" && team && year >= FIRST_SEASON_RANGE.min && year <= FIRST_SEASON_RANGE.max;

  const submit = async (event: FormEvent) => {
    event.preventDefault();
    if (!ready) return;
    setBusy(true);
    setError(null);
    try {
      onCreated?.(await create({ name, teamAbbr: team.abbr, startYear: year }));
    } catch (err) {
      setError(errorMessage(err, "Could not create the franchise."));
      setBusy(false);
    }
  };

  return (
    <form onSubmit={submit} style={style} className={cn("space-y-8", className)}>
      {header(team)}

      <div className="grid gap-4 sm:grid-cols-[1fr_9rem]">
        <label className="space-y-1.5">
          <span className={labelClass}>Franchise name</span>
          <Input
            value={name}
            onChange={(e) => setName(e.target.value)}
            placeholder="e.g. Foxborough Dynasty"
            maxLength={60}
          />
        </label>
        <label className="space-y-1.5">
          <span className={labelClass}>First season</span>
          <Input
            inputMode="numeric"
            value={startYear}
            onChange={(e) => setStartYear(e.target.value.replace(/\D/g, "").slice(0, 4))}
            aria-describedby="first-season-help"
          />
        </label>
        <p id="first-season-help" className="text-sm text-muted-foreground sm:col-span-2">
          Defaults to the current real NFL season. Real history before it is imported separately; everything
          after you capture as you play.
        </p>
      </div>

      <section className="space-y-2">
        <h2 className={labelClass}>Team</h2>
        {teams === undefined ? (
          <Skeleton className="h-96 rounded-xl" />
        ) : (
          <TeamPicker teams={teams} value={teamAbbr} onChange={setTeamAbbr} />
        )}
      </section>

      <div
        className={cn(
          "flex flex-wrap items-center gap-3",
          stickyBar &&
            "sticky bottom-0 -mx-4 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6",
        )}
      >
        <Button type="submit" variant="primary" size="lg" disabled={!ready || busy}>
          {busy ? "Creating…" : "Create franchise"}
        </Button>
        {error && (
          <p role="alert" className="text-sm text-loss">
            {error}
          </p>
        )}
        <span className="ml-auto">{actions}</span>
      </div>
    </form>
  );
}

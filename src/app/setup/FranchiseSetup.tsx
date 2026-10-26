import { useAuthActions } from "@convex-dev/auth/react";
import { useMutation, useQuery } from "convex/react";
import { useMemo, useState, type FormEvent } from "react";
import { api } from "@convex/_generated/api";
import { currentNflSeason, FIRST_SEASON_RANGE } from "@shared/domain";
import { TeamLogo } from "@/components/team/TeamLogo";
import { TeamPicker } from "@/components/team/TeamPicker";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { teamCssVars, useTheme } from "@/design/theme";
import { errorMessage } from "@/lib/errors";

const labelClass = "text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase";

/**
 * Franchise setup (FEATURES.md 5.0), shown instead of every screen until a franchise exists.
 * The page takes on the picked team's colors as a preview.
 */
export function FranchiseSetup() {
  const teams = useQuery(api.league.teams.list, {});
  const create = useMutation(api.franchise.setup.create);
  const { signOut } = useAuthActions();
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
      await create({ name, teamAbbr: team.abbr, startYear: year });
    } catch (err) {
      setError(errorMessage(err, "Could not create the franchise."));
      setBusy(false);
    }
  };

  return (
    <main style={style} className="pt-safe pb-safe min-h-dvh bg-background">
      <form onSubmit={submit} className="mx-auto max-w-3xl space-y-8 px-4 py-8 sm:px-6 sm:py-12">
        <header className="flex items-center gap-4">
          {team ? (
            <TeamLogo team={team} size="lg" />
          ) : (
            <img src="/favicon.svg" alt="" className="size-14 rounded-2xl" />
          )}
          <div>
            <p className={labelClass}>New franchise</p>
            <h1 className="font-display text-4xl leading-none font-bold tracking-wide uppercase">
              {team ? `${team.city} ${team.name}` : "Pick your team"}
            </h1>
          </div>
        </header>

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

        <div className="sticky bottom-0 -mx-4 flex flex-wrap items-center gap-3 border-t border-border bg-background/90 px-4 py-3 backdrop-blur sm:-mx-6 sm:px-6">
          <Button type="submit" variant="primary" size="lg" disabled={!ready || busy}>
            {busy ? "Creating…" : "Create franchise"}
          </Button>
          {error && (
            <p role="alert" className="text-sm text-loss">
              {error}
            </p>
          )}
          <Button variant="ghost" size="sm" className="ml-auto" onClick={() => void signOut()}>
            Sign out
          </Button>
        </div>
      </form>
    </main>
  );
}

import { CONFERENCES, DIVISIONS } from "@shared/domain";
import { readableOn } from "@/design/color";
import { cn } from "@/lib/cn";
import { TeamLogo, type TeamLike } from "./TeamLogo";

type PickableTeam = TeamLike & { conference: string; division: string; city?: string; name?: string };

type TeamPickerProps<T extends PickableTeam> = {
  teams: readonly T[];
  value: string | null;
  onChange: (abbr: string) => void;
  className?: string;
};

/** All 32 teams grouped by division in their own colors; one choice. Used by franchise setup. */
export function TeamPicker<T extends PickableTeam>({
  teams,
  value,
  onChange,
  className,
}: TeamPickerProps<T>) {
  return (
    <div role="radiogroup" aria-label="Team" className={cn("@container space-y-4", className)}>
      {CONFERENCES.flatMap((conference) =>
        DIVISIONS.map((division) => {
          const group = teams.filter((t) => t.conference === conference && t.division === division);
          if (group.length === 0) return null;
          return (
            <fieldset key={`${conference}-${division}`}>
              <legend className="mb-1.5 text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
                {conference} {division}
              </legend>
              <div className="grid grid-cols-2 gap-2 @lg:grid-cols-4">
                {group.map((team) => {
                  const selected = team.abbr === value;
                  return (
                    <button
                      key={team.abbr}
                      type="button"
                      role="radio"
                      aria-checked={selected}
                      aria-label={`${team.city ?? ""} ${team.name ?? team.abbr}`.trim()}
                      onClick={() => onChange(team.abbr)}
                      className={cn(
                        "flex min-h-12 items-center gap-2.5 rounded-xl border px-3 py-2 text-left text-sm transition-colors",
                        selected ? "border-transparent" : "border-border bg-surface hover:bg-surface-2",
                      )}
                      style={
                        selected
                          ? {
                              background: team.primaryColor,
                              color: readableOn(team.primaryColor),
                              boxShadow: `inset 0 -3px 0 ${team.secondaryColor}`,
                            }
                          : undefined
                      }
                    >
                      <TeamLogo team={team} size="sm" />
                      <span className="min-w-0 leading-tight">
                        <span className="block truncate text-xs opacity-75">{team.city}</span>
                        <span className="block truncate font-semibold">{team.name ?? team.abbr}</span>
                      </span>
                    </button>
                  );
                })}
              </div>
            </fieldset>
          );
        }),
      )}
    </div>
  );
}

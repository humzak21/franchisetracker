import { formatTeamStat, parseClock, TEAM_STAT_KEYS, TEAM_STATS } from "@shared/stats/teamRegistry";
import { Select } from "@/components/ui/select";
import { NumberField } from "./NumberField";
import { useReviewDraft } from "./reviewDraft";

/** Team stats as two columns of numbers, one per team, labelled from the team stat registry. */
export function TeamStatsEditor() {
  const { draft, set, flag } = useReviewDraft();
  if (!("teams" in draft)) return null;
  const teams = [draft.game.awayAbbr, draft.game.homeAbbr].filter((t): t is string => t !== null);

  return (
    <div role="group" aria-label="Team stats draft" className="@container grid gap-3 @lg:grid-cols-2">
      {draft.teams.map((column, i) => (
        <section key={i} className="space-y-3 rounded-xl border border-border bg-surface p-3">
          <Select
            aria-label={`Team for column ${i + 1}`}
            className={flag(`teams.${i}.teamAbbr`) === "error" ? "rounded-lg ring-2 ring-loss" : undefined}
            value={column.teamAbbr ?? ""}
            placeholder="Which team?"
            onValueChange={(abbr) => set(`teams.${i}.teamAbbr`, abbr)}
            options={teams.map((abbr) => ({ value: abbr, label: abbr }))}
          />
          <div className="grid grid-cols-2 gap-2 @sm:grid-cols-3">
            {TEAM_STAT_KEYS.map((key) => {
              const time = TEAM_STATS[key].format === "time";
              return (
                <NumberField
                  key={key}
                  label={key === "totalYds" ? "Total yards (pass + rush)" : TEAM_STATS[key].label}
                  readOnly={key === "totalYds"}
                  value={column.stats[key]}
                  flag={flag(`teams.${i}.stats.${key}`)}
                  format={time ? (v) => formatTeamStat(key, v) : undefined}
                  parse={time ? (text) => (text.trim() === "" ? undefined : parseClock(text)) : undefined}
                  onChange={(v) => set(`teams.${i}.stats.${key}`, v)}
                />
              );
            })}
          </div>
        </section>
      ))}
    </div>
  );
}

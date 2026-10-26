import { NFL_TEAMS } from "@shared/domain";
import { Select } from "@/components/ui/select";
import { NumberField } from "./NumberField";
import { useReviewDraft } from "./reviewDraft";

const TEAM_OPTIONS = [...NFL_TEAMS]
  .sort((a, b) => a.city.localeCompare(b.city))
  .map((t) => ({ value: t.abbr, label: `${t.abbr} · ${t.city} ${t.name}` }));

const labelClass = "block text-[11px] text-muted-foreground";

/** The final score header both game targets carry: teams, scores and overtime. */
export function GameHeaderFields() {
  const { draft, set, flag } = useReviewDraft();
  if (!("game" in draft)) return null;
  const { game } = draft;
  const teamField = (side: "home" | "away") => {
    const path = `game.${side}Abbr`;
    return (
      <label className="min-w-0">
        <span className={labelClass}>{side === "home" ? "Home" : "Away"}</span>
        <Select
          className={flag(path) === "error" ? "rounded-lg ring-2 ring-loss" : undefined}
          value={(side === "home" ? game.homeAbbr : game.awayAbbr) ?? ""}
          placeholder="Team"
          onValueChange={(abbr) => set(path, abbr)}
          options={TEAM_OPTIONS}
        />
      </label>
    );
  };
  return (
    <div className="grid grid-cols-[1fr_5.5rem] gap-x-3 gap-y-2">
      {teamField("away")}
      <NumberField
        label="Score"
        value={game.awayScore}
        flag={flag("game.awayScore")}
        onChange={(v) => set("game.awayScore", v ?? null)}
      />
      {teamField("home")}
      <NumberField
        label="Score"
        value={game.homeScore}
        flag={flag("game.homeScore")}
        onChange={(v) => set("game.homeScore", v ?? null)}
      />
      <label className="col-span-2 flex min-h-11 items-center gap-2 text-sm">
        <input
          type="checkbox"
          checked={game.overtime}
          onChange={(e) => set("game.overtime", e.target.checked)}
          className="size-4 accent-[var(--primary)]"
        />
        Went to overtime
        {game.lineScore && (
          <span className="num ml-auto text-xs text-muted-foreground">
            Quarters {game.lineScore.away.join("-")} / {game.lineScore.home.join("-")}
          </span>
        )}
      </label>
    </div>
  );
}

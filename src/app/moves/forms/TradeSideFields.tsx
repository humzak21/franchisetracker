import type { Id } from "@convex/_generated/dataModel";
import { Field } from "@/components/forms/Field";
import { PeopleList } from "./PeopleList";
import { PersonPicker } from "./PersonPicker";
import { PickList } from "./PickList";
import { TeamSelect } from "./TeamSelect";
import { personKey, type TradeSide } from "./moveForm";
import type { FormTeam } from "./types";

/** One team in a trade and everything it sends: players from its roster or typed in, and picks. */
export function TradeSideFields({
  title,
  side,
  onChange,
  teams,
  seasonId,
  year,
  taken,
}: {
  title: string;
  side: TradeSide;
  onChange: (next: TradeSide) => void;
  teams: readonly FormTeam[];
  seasonId: Id<"seasons">;
  year: number;
  /** Players already in the trade on either side. */
  taken: ReadonlySet<string>;
}) {
  const team = teams.find((t) => t._id === side.teamId);
  const sends = team ? `${team.abbr} sends` : "Sends";
  return (
    <fieldset className="min-w-0 space-y-2 rounded-xl border border-border p-3">
      <legend className="px-1 font-display text-sm font-semibold tracking-wide uppercase">{title}</legend>
      <Field label="Team">
        <TeamSelect
          teams={teams}
          value={side.teamId}
          placeholder="Pick a team"
          onChange={(teamId) =>
            onChange({ teamId, players: side.players.filter((p) => p.kind === "new"), picks: side.picks })
          }
        />
      </Field>
      <div className="text-[11px] font-semibold tracking-[0.08em] text-subtle-foreground uppercase">
        {sends}
      </div>
      <PeopleList
        people={side.players}
        onRemove={(p) =>
          onChange({ ...side, players: side.players.filter((x) => personKey(x) !== personKey(p)) })
        }
      />
      <PersonPicker
        key={side.teamId}
        label={`${title} player`}
        seasonId={seasonId}
        teamId={side.teamId}
        exclude={taken}
        onPick={(p) => !taken.has(personKey(p)) && onChange({ ...side, players: [...side.players, p] })}
      />
      <PickList
        label={`${title} pick`}
        year={year}
        teams={teams.filter((t) => t._id !== side.teamId)}
        picks={side.picks}
        onChange={(picks) => onChange({ ...side, picks })}
      />
    </fieldset>
  );
}

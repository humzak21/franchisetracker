import type { Id } from "@convex/_generated/dataModel";
import { Select } from "@/components/ui/select";
import type { FormTeam } from "./types";

/** One of the 32 teams, grouped by division; native so phones open their own picker. */
export function TeamSelect({
  teams,
  value,
  onChange,
  placeholder,
  "aria-label": ariaLabel,
}: {
  teams: readonly FormTeam[];
  value: Id<"teams"> | undefined;
  onChange: (teamId: Id<"teams">) => void;
  placeholder?: string;
  "aria-label"?: string;
}) {
  return (
    <Select
      aria-label={ariaLabel}
      value={value ?? ""}
      placeholder={placeholder}
      options={teams.map((t) => ({
        value: t._id,
        label: `${t.city} ${t.name}`,
        group: `${t.conference} ${t.division}`,
      }))}
      onValueChange={(id) => onChange(id as Id<"teams">)}
    />
  );
}

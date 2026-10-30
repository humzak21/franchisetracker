import { useNavigate } from "@tanstack/react-router";
import type { Doc } from "@convex/_generated/dataModel";
import { Select } from "@/components/ui/select";

/** Whose roster is shown. Other teams' are in the URL, so a link can open one. */
export function RosterTeamSelect({
  teams,
  value,
  userTeamAbbr,
}: {
  teams: readonly Doc<"teams">[];
  value: string;
  userTeamAbbr: string | undefined;
}) {
  const navigate = useNavigate();
  const options = [...teams]
    .sort((a, b) => a.city.localeCompare(b.city) || a.name.localeCompare(b.name))
    .map((t) => ({ value: t.abbr, label: `${t.city} ${t.name}` }));
  return (
    <Select
      className="w-60 max-w-full"
      aria-label="Team"
      value={value}
      options={options}
      onValueChange={(abbr) =>
        void navigate({ to: "/roster", search: abbr === userTeamAbbr ? {} : { team: abbr } })
      }
    />
  );
}

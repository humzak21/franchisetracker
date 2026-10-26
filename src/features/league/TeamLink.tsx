import { Link } from "@tanstack/react-router";
import type { ComponentProps } from "react";
import { TeamChip } from "@/components/team/TeamChip";
import { cn } from "@/lib/cn";

/** A team chip that opens the team's history inside the franchise. */
export function TeamLink({ team, className, ...chip }: ComponentProps<typeof TeamChip>) {
  return (
    <Link
      to="/league/teams/$abbr"
      params={{ abbr: team.abbr.toLowerCase() }}
      className={cn("min-w-0 rounded hover:underline", className)}
    >
      <TeamChip team={team} {...chip} />
    </Link>
  );
}

import { cn } from "@/lib/cn";
import { TeamLogo, type LogoSize, type TeamLike } from "./TeamLogo";

type TeamChipProps = {
  team: TeamLike;
  /** abbr: "NE" · name: "Patriots" · full: "New England Patriots" */
  label?: "abbr" | "name" | "full";
  record?: string;
  size?: Extract<LogoSize, "xs" | "sm" | "md">;
  className?: string;
};

export function TeamChip({ team, label = "name", record, size = "sm", className }: TeamChipProps) {
  const text =
    label === "abbr"
      ? team.abbr
      : label === "full"
        ? `${team.city ?? ""} ${team.name ?? team.abbr}`.trim()
        : (team.name ?? team.abbr);
  return (
    <span className={cn("inline-flex min-w-0 items-center gap-2", className)}>
      <TeamLogo team={team} size={size} />
      <span className="truncate font-medium">{text}</span>
      {record && <span className="num shrink-0 text-xs text-muted-foreground">({record})</span>}
    </span>
  );
}

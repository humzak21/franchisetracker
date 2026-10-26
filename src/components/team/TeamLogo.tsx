import { readableOn } from "@/design/color";
import { cn } from "@/lib/cn";

/** The fields any team-rendering component needs. Convex `teams` docs satisfy it. */
export type TeamLike = {
  abbr: string;
  city?: string;
  name?: string;
  primaryColor: string;
  secondaryColor: string;
  logoUrl?: string | null;
};

const sizes = {
  xs: "size-5 text-[8px]",
  sm: "size-7 text-[10px]",
  md: "size-10 text-sm",
  lg: "size-14 text-lg",
  xl: "size-20 text-2xl",
} as const;
export type LogoSize = keyof typeof sizes;

/** Team logo. Uses the cached ESPN logo when present, otherwise a monogram shield in team colors. */
export function TeamLogo({
  team,
  size = "md",
  className,
}: {
  team: TeamLike;
  size?: LogoSize;
  className?: string;
}) {
  const label = team.name ? `${team.city ?? ""} ${team.name}`.trim() : team.abbr;
  if (team.logoUrl) {
    return (
      <img src={team.logoUrl} alt={label} className={cn("shrink-0 object-contain", sizes[size], className)} />
    );
  }
  return (
    <span
      role="img"
      aria-label={label}
      className={cn(
        "relative grid shrink-0 place-items-center overflow-hidden rounded-[30%] font-display leading-none font-bold tracking-wide",
        sizes[size],
        className,
      )}
      style={{
        background: `linear-gradient(140deg, ${team.primaryColor} 0 58%, ${team.secondaryColor} 58% 100%)`,
        color: readableOn(team.primaryColor),
        boxShadow: `inset 0 0 0 1px rgb(255 255 255 / 0.12)`,
      }}
    >
      <span className="drop-shadow-[0_1px_1px_rgb(0_0_0/0.35)]">{team.abbr}</span>
    </span>
  );
}

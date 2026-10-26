import { useState } from "react";
import { readableOn } from "@/design/color";
import { cn } from "@/lib/cn";
import type { TeamLike } from "../team/TeamLogo";

const sizes = {
  xs: "size-6 text-[9px]",
  sm: "size-8 text-[11px]",
  md: "size-11 text-sm",
  lg: "size-16 text-xl",
  xl: "size-24 text-3xl",
} as const;
export type HeadshotSize = keyof typeof sizes;

export function initials(name: string): string {
  const parts = name
    .replace(/\b(Jr\.?|Sr\.?|II|III|IV)$/i, "")
    .trim()
    .split(/\s+/);
  return (
    (parts[0]?.[0] ?? "") + (parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "")
  ).toUpperCase();
}

/** Player headshot: the photo for real players, a monogram in team colors for everyone else. */
export function Headshot({
  name,
  src,
  team,
  size = "md",
  className,
}: {
  name: string;
  src?: string | null;
  team?: Pick<TeamLike, "primaryColor" | "secondaryColor">;
  size?: HeadshotSize;
  className?: string;
}) {
  const base = cn("shrink-0 overflow-hidden rounded-full", sizes[size], className);
  // A photo ESPN no longer serves falls back to the monogram instead of a broken image.
  const [failed, setFailed] = useState<string | null>(null);
  if (src && failed !== src)
    return (
      <img
        src={src}
        alt={name}
        onError={() => setFailed(src)}
        className={cn(base, "bg-surface-2 object-cover object-top")}
        loading="lazy"
      />
    );
  const primary = team?.primaryColor ?? "#334155";
  return (
    <span
      role="img"
      aria-label={name}
      className={cn(base, "grid place-items-center font-display font-bold tracking-wide")}
      style={{
        background: `radial-gradient(circle at 30% 25%, ${team?.secondaryColor ?? "#64748b"}55, transparent 60%), ${primary}`,
        color: readableOn(primary),
        boxShadow: "inset 0 0 0 1px rgb(255 255 255 / 0.12)",
      }}
    >
      {initials(name)}
    </span>
  );
}

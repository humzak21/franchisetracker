import { useId } from "react";
import { distance, readableOn } from "@/design/color";
import { cn } from "@/lib/cn";

type JerseyTeam = { primaryColor: string; secondaryColor: string };

const NEUTRAL: JerseyTeam = { primaryColor: "#334155", secondaryColor: "#94a3b8" };

/** Back of a jersey: collar, shoulders, sleeves and hem, on a 240 x 300 canvas. */
const BODY =
  "M92 44 Q120 58 148 44 L188 56 L230 112 L204 136 L182 112 L182 288 Q120 296 58 288 L58 112 L36 136 L10 112 L52 56 Z";
const COLLAR = "M92 44 Q120 58 148 44";

/** Two stripes across each sleeve, parallel to the cuff; clipped to the body, so they can overshoot. */
const STRIPES = [14, 25].flatMap((t) => {
  const [dx, dy] = [-0.39 * t, -0.92 * t];
  const right = `M${244 + dx} ${99 + dy} L${190 + dx} ${149 + dy}`;
  const left = `M${-4 - dx} ${99 + dy} L${50 - dx} ${149 + dy}`;
  return [right, left];
});

/**
 * A jersey on a hanger in team colors, the number and name across the back: the Hall of Fame
 * wall's centerpiece. Scales to its parent's width at a 4:5 ratio.
 */
export function HangingJersey({
  team,
  number,
  name,
  className,
}: {
  team?: JerseyTeam | null;
  number?: number;
  /** Printed across the shoulders; usually the last name. */
  name: string;
  className?: string;
}) {
  const id = useId().replace(/:/g, "");
  const { primaryColor, secondaryColor } = team ?? NEUTRAL;
  const ink = readableOn(primaryColor);
  // Trim in the second color, unless it would vanish into the first (all-navy teams).
  const trim = distance(secondaryColor, primaryColor) < 60 ? ink : secondaryColor;
  const label = name.toUpperCase();

  return (
    <svg
      viewBox="0 0 240 300"
      role="img"
      aria-label={`${name} jersey${number === undefined ? "" : `, number ${number}`}`}
      className={cn("aspect-[4/5] w-full drop-shadow-[0_18px_22px_rgb(0_0_0/0.35)]", className)}
    >
      <defs>
        <clipPath id={`${id}-body`}>
          <path d={BODY} />
        </clipPath>
        <linearGradient id={`${id}-shade`} x1="0" x2="1" y1="0" y2="0">
          <stop offset="0" stopColor="#000" stopOpacity="0.32" />
          <stop offset="0.28" stopColor="#000" stopOpacity="0.05" />
          <stop offset="0.5" stopColor="#fff" stopOpacity="0.08" />
          <stop offset="0.72" stopColor="#000" stopOpacity="0.05" />
          <stop offset="1" stopColor="#000" stopOpacity="0.32" />
        </linearGradient>
        <linearGradient id={`${id}-drop`} x1="0" x2="0" y1="0" y2="1">
          <stop offset="0" stopColor="#fff" stopOpacity="0.1" />
          <stop offset="1" stopColor="#000" stopOpacity="0.28" />
        </linearGradient>
      </defs>

      <g className="fill-none stroke-subtle-foreground" strokeLinecap="round" strokeLinejoin="round">
        <path d="M120 40 V22 a9 9 0 1 1 9 -9" strokeWidth="4" />
        <path d="M54 58 L120 32 L186 58" strokeWidth="5" />
      </g>

      <path d={BODY} fill={primaryColor} />
      <g clipPath={`url(#${id}-body)`}>
        {STRIPES.map((d) => (
          <path key={d} d={d} stroke={trim} strokeWidth="6" />
        ))}
        <path d="M58 112 V288 M182 112 V288" stroke="#000" strokeOpacity="0.12" strokeWidth="3" />
        <rect width="240" height="300" fill={`url(#${id}-shade)`} />
        <rect width="240" height="300" fill={`url(#${id}-drop)`} />
      </g>
      <path d={COLLAR} fill="none" stroke={trim} strokeWidth="6" strokeLinecap="round" />

      <text
        x="120"
        y="102"
        textAnchor="middle"
        fill={ink}
        className="font-display"
        fontSize="22"
        fontWeight="700"
        letterSpacing="2"
        {...(label.length > 9 ? { textLength: 112, lengthAdjust: "spacingAndGlyphs" } : {})}
      >
        {label}
      </text>
      {number !== undefined && (
        <text
          x="120"
          y="222"
          textAnchor="middle"
          fill={ink}
          stroke={trim}
          strokeWidth="3"
          paintOrder="stroke"
          className="num font-display"
          fontSize="104"
          fontWeight="700"
        >
          {number}
        </text>
      )}
    </svg>
  );
}

import type { ReactNode } from "react";
import type { Conference } from "@shared/domain";
import { cn } from "@/lib/cn";
import { CONFERENCE_TONE } from "./conference";

/** A conference's column heading: its name in the conference color over a rule, so AFC and NFC never blur together. */
export function ConferenceHeading({
  conference,
  detail,
  size = "md",
}: {
  conference: Conference;
  /** Beside the name: a count, a caption. */
  detail?: ReactNode;
  size?: "sm" | "md";
}) {
  const tone = CONFERENCE_TONE[conference];
  return (
    <div className={cn("flex items-baseline justify-between gap-2 border-t-[3px] pt-1.5", tone.border)}>
      <h3
        className={cn(
          "font-display leading-none font-bold tracking-wide uppercase",
          tone.text,
          size === "md" ? "text-2xl" : "text-base",
        )}
      >
        {conference}
      </h3>
      {detail && <span className="text-xs text-muted-foreground">{detail}</span>}
    </div>
  );
}

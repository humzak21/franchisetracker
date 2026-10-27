import { Link } from "@tanstack/react-router";
import { PencilLine } from "lucide-react";
import type { TargetKey } from "@shared/ingestion/targets";
import { Button } from "@/components/ui/button";

type ManualEntryLinkProps = {
  target: TargetKey;
  /** Presets the season (an award or draft screen's season). */
  seasonId?: string;
  /** Presets the game, which also sets the season and week. */
  gameId?: string;
  label: string;
};

/**
 * The manual counterpart of a capture button: opens manual entry for one screenshot target,
 * with its season or game preset, so anything a screenshot gives can also be typed in.
 */
export function ManualEntryLink({ target, seasonId, gameId, label }: ManualEntryLinkProps) {
  return (
    <Button asChild size="sm" variant="outline">
      <Link to="/inbox/manual" search={{ target, seasonId, gameId }}>
        <PencilLine /> {label}
      </Link>
    </Button>
  );
}

import { Link } from "@tanstack/react-router";
import { HeartPulse } from "lucide-react";
import { weekLabel } from "@shared/domain";
import { EmptyState } from "@/components/data/EmptyState";
import { PlayerChip } from "@/components/player/PlayerChip";
import { TeamChip } from "@/components/team/TeamChip";
import { Badge } from "@/components/ui/misc";
import { cn } from "@/lib/cn";
import type { Injury } from "./types";

/** The season's injury report (FEATURES.md 5.10): who, when, what, how long, and IR. */
export function InjuriesView({ injuries }: { injuries: Injury[] }) {
  if (injuries.length === 0) {
    return (
      <EmptyState
        icon={HeartPulse}
        title="No injuries logged"
        description="Capture the injury report during the season."
      />
    );
  }
  return (
    <ul className="@container grid gap-2 @tablet:grid-cols-2 @desktop:grid-cols-3">
      {injuries.map((i) => (
        <li
          key={i._id}
          className={cn(
            "rounded-xl border bg-surface p-3",
            i.isUser ? "border-border" : "border-dashed border-border",
          )}
        >
          <div className="mb-2 flex items-center gap-2 text-xs text-muted-foreground">
            <span>{i.weekKey ? weekLabel(i.weekKey, "long") : "Offseason"}</span>
            {i.onIr && <Badge tone="loss">IR</Badge>}
            {i.team && <TeamChip team={i.team} label="abbr" size="xs" className="ml-auto" />}
          </div>
          {i.player.playerId ? (
            <Link
              to="/players/$playerId"
              params={{ playerId: i.player.playerId }}
              className="block hover:underline"
            >
              <PlayerChip
                player={{
                  displayName: i.player.name,
                  position: i.player.position ?? "",
                  headshotUrl: i.player.headshotUrl,
                }}
                size="sm"
                caption={[i.injuryType, i.lengthLabel].filter(Boolean).join(" · ")}
              />
            </Link>
          ) : (
            <span className="text-sm font-medium">{i.player.name}</span>
          )}
        </li>
      ))}
    </ul>
  );
}

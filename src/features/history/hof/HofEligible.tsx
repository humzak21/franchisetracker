import { Link } from "@tanstack/react-router";
import type { FunctionReturnType } from "convex/server";
import type { api } from "@convex/_generated/api";
import { Section } from "@/components/layout/Section";
import { PlayerChip } from "@/components/player/PlayerChip";
import { Badge } from "@/components/ui/misc";

type Eligible = FunctionReturnType<typeof api.hof.case.eligible>;

/** Retired with the team, five seasons gone and not on the wall: open their page to weigh the case. */
export function HofEligible({ eligible }: { eligible: Eligible }) {
  if (eligible.players.length === 0) return null;
  return (
    <Section title="Eligible" description={`Five seasons out of the game by ${eligible.year}.`}>
      <ul className="grid gap-2 sm:grid-cols-2">
        {eligible.players.map((p) => (
          <li key={p.playerId}>
            <Link
              to="/players/$playerId"
              params={{ playerId: p.playerId }}
              className="flex min-h-12 items-center justify-between gap-2 rounded-xl border border-border bg-surface px-3 py-1.5 transition-colors hover:bg-surface-2"
            >
              <PlayerChip size="sm" player={p} caption={`Retired ${p.retiredYear}`} />
              {p.newlyEligible && <Badge tone="accent">New</Badge>}
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

import { Link } from "@tanstack/react-router";
import { api } from "@convex/_generated/api";
import { Section } from "@/components/layout/Section";
import { PlayerChip } from "@/components/player/PlayerChip";
import { useQuery } from "@/lib/convex/useQuery";

/**
 * Retired players still in the team's career records: open their page to induct them. Those on
 * the eligible list above it are left out.
 */
export function HofCandidates({ eligible }: { eligible: ReadonlySet<string> }) {
  const all = useQuery(api.hof.entries.candidates, {});
  const candidates = all?.filter((c) => !eligible.has(c.playerId));
  if (!candidates || candidates.length === 0) return null;
  return (
    <Section title="Candidates" description="Retired, and still in the team's career records.">
      <ul className="grid gap-2 sm:grid-cols-2">
        {candidates.map((c) => (
          <li key={c.playerId}>
            <Link
              to="/players/$playerId"
              params={{ playerId: c.playerId }}
              className="flex min-h-12 items-center rounded-xl border border-border bg-surface px-3 py-1.5 transition-colors hover:bg-surface-2"
            >
              <PlayerChip
                size="sm"
                player={c}
                caption={`${c.placements} career ${c.placements === 1 ? "list" : "lists"}, best #${c.bestRank}`}
              />
            </Link>
          </li>
        ))}
      </ul>
    </Section>
  );
}

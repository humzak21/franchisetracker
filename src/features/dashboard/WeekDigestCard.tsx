import { Link } from "@tanstack/react-router";
import { Sparkles, Trophy, type LucideIcon } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { digestHeadline, digestRecord, digestText, standingLine } from "@shared/games/digest";
import { Section } from "@/components/layout/Section";
import { CopyButton } from "@/components/ui/CopyButton";
import { useQuery } from "@/lib/convex/useQuery";

function Facts({ icon: Icon, lines }: { icon: LucideIcon; lines: readonly string[] }) {
  return lines.map((line) => (
    <li key={line} className="flex items-start gap-2 text-sm">
      <Icon aria-hidden className="mt-0.5 size-4 shrink-0 text-primary" />
      <span className="min-w-0">{line}</span>
    </li>
  ));
}

/** The latest week in one card (FEATURES.md 5.1), copied as text for the group chat. */
export function WeekDigestCard({ seasonId, className }: { seasonId: Id<"seasons">; className?: string }) {
  const digest = useQuery(api.dashboard.digest.latest, { seasonId });
  if (!digest) return null;
  const standing = digest.standing && standingLine(digest.standing, digest.division);
  return (
    <Section
      title="The week"
      className={className}
      actions={<CopyButton text={digestText(digest)} label="Copy" />}
    >
      <div className="space-y-3 rounded-xl border border-border bg-surface p-4">
        <div>
          <Link
            to="/games/$gameId"
            params={{ gameId: digest.gameId }}
            className="font-display text-xl leading-tight font-bold hover:underline"
          >
            {digestHeadline(digest)}
          </Link>
          <p className="num text-sm text-muted-foreground">
            {[digestRecord(digest), standing].filter(Boolean).join(" · ")}
          </p>
        </div>
        {digest.stars.length > 0 && (
          <ul className="space-y-0.5 text-sm">
            {digest.stars.map((star) => (
              <li key={star.name}>
                <span className="font-medium">{star.name}</span>
                {star.statLine && <span className="text-muted-foreground"> {star.statLine}</span>}
              </li>
            ))}
          </ul>
        )}
        {digest.records.length + digest.milestones.length > 0 && (
          <ul className="space-y-1">
            <Facts icon={Trophy} lines={digest.records} />
            <Facts icon={Sparkles} lines={digest.milestones} />
          </ul>
        )}
      </div>
    </Section>
  );
}

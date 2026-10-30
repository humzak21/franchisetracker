import { CopyCheck } from "lucide-react";
import { api } from "@convex/_generated/api";
import type { Id } from "@convex/_generated/dataModel";
import { Notice } from "@/components/data/Notice";
import { useQuery } from "@/lib/convex/useQuery";

/** Says so at the top of the page when someone else looks like this player. */
export function PossibleDuplicate({ playerId }: { playerId: Id<"players"> }) {
  const matches = useQuery(api.players.identity.duplicatesOf, { playerId });
  const [first] = matches ?? [];
  if (!first) return null;
  const others = (matches?.length ?? 1) - 1;
  return (
    <Notice icon={CopyCheck}>
      May be the same person as {first.displayName}
      {others > 0 ? ` and ${others} more` : ""}.{" "}
      <a href="#identity" className="font-medium underline">
        Check under Identity
      </a>
    </Notice>
  );
}

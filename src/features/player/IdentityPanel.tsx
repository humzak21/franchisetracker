import { useMutation } from "convex/react";
import { useState, type ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Segmented } from "@/components/ui/segmented";
import { errorMessage } from "@/lib/errors";
import { MergeDuplicate } from "./MergeDuplicate";
import type { PlayerPage } from "./types";

function Row({ label, hint, children }: { label: string; hint?: string; children: ReactNode }) {
  return (
    <div className="grid gap-1.5 @tablet:grid-cols-[12rem_1fr] @tablet:gap-4">
      <div>
        <div className="text-sm font-medium">{label}</div>
        {hint && <div className="text-xs text-muted-foreground">{hint}</div>}
      </div>
      <div className="min-w-0">{children}</div>
    </div>
  );
}

/**
 * Aliases, real or fictional, and merging a duplicate in. Renaming is in the player's Edit sheet,
 * which keeps the old name as an alias.
 */
export function IdentityPanel({ page }: { page: PlayerPage }) {
  const { player } = page;
  const setAliases = useMutation(api.players.identity.setAliases);
  const setReal = useMutation(api.players.identity.setReal);
  const [aliases, setAliasText] = useState(player.aliases.join(", "));
  const [error, setError] = useState<string | null>(null);
  const attempt = (fn: () => Promise<unknown>) => {
    setError(null);
    fn().catch((e: unknown) => setError(errorMessage(e, "Could not save")));
  };

  return (
    <div className="@container space-y-5 rounded-xl border border-border bg-surface p-4">
      <Row label="Aliases" hint="How screenshots print the name, comma separated.">
        <form
          className="flex gap-2"
          onSubmit={(e) => {
            e.preventDefault();
            attempt(() => setAliases({ playerId: player._id, aliases: aliases.split(",") }));
          }}
        >
          <Input value={aliases} onChange={(e) => setAliasText(e.target.value)} aria-label="Aliases" />
          <Button type="submit" variant="outline">
            Save
          </Button>
        </form>
      </Row>
      <Row label="Player" hint="Fictional players get a monogram card.">
        <Segmented
          size="sm"
          aria-label="Real or fictional"
          value={player.isReal ? "real" : "fictional"}
          onChange={(v) => attempt(() => setReal({ playerId: player._id, isReal: v === "real" }))}
          options={[
            { value: "real", label: "Real" },
            { value: "fictional", label: "Fictional" },
          ]}
        />
      </Row>
      <Row label="Merge a duplicate" hint="When one person was entered twice.">
        <MergeDuplicate playerId={player._id} name={player.displayName} />
      </Row>
      {error && <p className="text-sm text-loss">{error}</p>}
    </div>
  );
}

import { useAction, useMutation } from "convex/react";
import { Copy, ExternalLink, KeyRound, Trash2 } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Section } from "@/components/layout/Section";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Skeleton } from "@/components/ui/misc";
import { errorMessage } from "@/lib/errors";
import { formatAge } from "@/lib/time";
import { useQuery } from "@/lib/convex/useQuery";

const DOCS_URL = "https://github.com/humzak21/franchisetracker/blob/main/docs/SHORTCUT.md";

function CopyField({ label, value }: { label: string; value: string }) {
  const [copied, setCopied] = useState(false);
  return (
    <div className="flex items-center gap-2">
      <Input
        readOnly
        value={value}
        aria-label={label}
        className="num font-mono text-xs"
        onFocus={(e) => e.target.select()}
      />
      <Button
        size="icon"
        variant="secondary"
        aria-label={`Copy ${label}`}
        onClick={() => void navigator.clipboard.writeText(value).then(() => setCopied(true))}
      >
        <Copy />
      </Button>
      {copied && <span className="text-xs text-win">Copied</span>}
    </div>
  );
}

/** Tokens and the endpoint for the Apple Shortcut that posts screenshots straight into the inbox. */
export function ShortcutSettings() {
  const settings = useQuery(api.ingestion.settings.get, {});
  const tokens = useQuery(api.ingestion.tokens.list, {});
  const create = useAction(api.ingestion.tokens.create);
  const revoke = useMutation(api.ingestion.tokens.revoke);
  const [label, setLabel] = useState("iPhone");
  const [fresh, setFresh] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);

  const generate = async () => {
    setError(null);
    try {
      setFresh(await create({ label }));
    } catch (err) {
      setError(errorMessage(err, "Could not create a token."));
    }
  };

  return (
    <Section
      title="Apple Shortcut"
      description="Share photos from the camera roll straight into the inbox, tagged with a screen and week."
      variant="card"
      actions={
        <Button asChild size="sm" variant="ghost">
          <a href={DOCS_URL} target="_blank" rel="noreferrer">
            Setup guide <ExternalLink />
          </a>
        </Button>
      }
    >
      <div className="space-y-4">
        {settings?.shortcutUrl && <CopyField label="Endpoint" value={settings.shortcutUrl} />}
        {fresh && (
          <div className="space-y-1.5 rounded-lg border border-warn/40 bg-warn/10 p-3">
            <p className="text-sm font-medium">
              Copy this token into the Shortcut now. It is not shown again.
            </p>
            <CopyField label="Token" value={fresh} />
          </div>
        )}
        <div className="flex gap-2">
          <Input
            value={label}
            onChange={(e) => setLabel(e.target.value)}
            aria-label="Token label"
            maxLength={40}
          />
          <Button variant="primary" onClick={() => void generate()}>
            <KeyRound /> New token
          </Button>
        </div>
        {error && <p className="text-sm text-loss">{error}</p>}
        {tokens === undefined ? (
          <Skeleton className="h-12" />
        ) : tokens.length === 0 ? (
          <p className="text-sm text-muted-foreground">No tokens yet.</p>
        ) : (
          <ul className="divide-y divide-border rounded-lg border border-border">
            {tokens.map((t) => (
              <li key={t._id} className="flex items-center gap-3 px-3 py-2">
                <div className="min-w-0 flex-1">
                  <div className="truncate text-sm font-medium">{t.label}</div>
                  <div className="text-xs text-muted-foreground">
                    Created {formatAge(t.createdAt)} ·{" "}
                    {t.lastUsedAt ? `last used ${formatAge(t.lastUsedAt)}` : "never used"}
                  </div>
                </div>
                <Button variant="ghost" size="sm" onClick={() => void revoke({ tokenId: t._id })}>
                  <Trash2 /> Revoke
                </Button>
              </li>
            ))}
          </ul>
        )}
      </div>
    </Section>
  );
}

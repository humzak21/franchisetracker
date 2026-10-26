import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { LogOut, SlidersHorizontal } from "lucide-react";
import { api } from "@convex/_generated/api";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Section } from "@/components/layout/Section";
import { Headshot } from "@/components/player/Headshot";
import { Button } from "@/components/ui/button";
import { Skeleton } from "@/components/ui/misc";
import { ExtractionSettings } from "./ExtractionSettings";
import { HighlightSettings } from "./HighlightSettings";
import { HistorySettings } from "./HistorySettings";
import { IdentitySettings } from "./IdentitySettings";
import { ShortcutSettings } from "./ShortcutSettings";

function Account() {
  const me = useQuery(api.account.me, {});
  const { signOut } = useAuthActions();
  return (
    <Section title="Account" variant="card">
      <div className="flex flex-wrap items-center gap-4">
        {me === undefined ? (
          <Skeleton className="size-11 rounded-full" />
        ) : (
          <Headshot name={me.name ?? me.email ?? "Owner"} src={me.image} size="md" />
        )}
        <div className="min-w-0 flex-1">
          <div className="truncate font-medium">{me?.name ?? (me ? "Owner" : " ")}</div>
          <div className="truncate text-sm text-muted-foreground">{me?.email ?? " "}</div>
        </div>
        <Button variant="outline" onClick={() => void signOut()}>
          <LogOut /> Sign out
        </Button>
      </div>
    </Section>
  );
}

export function SettingsScreen() {
  return (
    <Page title="Settings">
      <div className="mx-auto max-w-3xl space-y-8">
        <Account />
        <HistorySettings />
        <IdentitySettings />
        <HighlightSettings />
        <ExtractionSettings />
        <ShortcutSettings />
        <EmptyState
          icon={SlidersHorizontal}
          title="More settings arrive with their sprints"
          description="Export and backup (Sprint 9)."
        />
      </div>
    </Page>
  );
}

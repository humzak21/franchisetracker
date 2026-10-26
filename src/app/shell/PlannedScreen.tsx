import { Link } from "@tanstack/react-router";
import { Compass } from "lucide-react";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { navItem } from "../nav";
import { useSeason } from "../season";

/** Screens that read per season show the season switcher in their header. */
const SEASONAL = new Set(["schedule", "roster", "stats", "league", "awards", "draft", "transactions"]);

/** Placeholder for a screen a later sprint delivers. Says which sprint, so the shell never looks broken. */
export function PlannedScreen({ nav }: { nav: string }) {
  const item = navItem(nav);
  const { season } = useSeason();
  const seasonal = SEASONAL.has(nav);
  return (
    <Page
      title={item.label}
      eyebrow={seasonal && season ? `${season.year} season` : undefined}
      season={seasonal}
    >
      <EmptyState
        size="page"
        icon={item.icon}
        title={`${item.label} arrives in Sprint ${item.sprint}`}
        description={`${item.description}. The shell, data model and components are in place; this screen is built in Sprint ${item.sprint} of docs/SPRINTS.md.`}
        action={
          <Button asChild variant="outline">
            <Link to="/dev/components">Browse the component gallery</Link>
          </Button>
        }
      />
    </Page>
  );
}

export function NotFoundScreen() {
  return (
    <Page title="Not found">
      <EmptyState
        size="page"
        icon={Compass}
        title="Off the field"
        description="That page does not exist."
        action={
          <Button asChild variant="primary">
            <Link to="/">Back home</Link>
          </Button>
        }
      />
    </Page>
  );
}

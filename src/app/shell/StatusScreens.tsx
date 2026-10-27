import { Link } from "@tanstack/react-router";
import { Compass, TriangleAlert } from "lucide-react";
import { useEffect } from "react";
import { EmptyState } from "@/components/data/EmptyState";
import { Page } from "@/components/layout/Page";
import { Button } from "@/components/ui/button";
import { useReportError } from "../errors/useReportError";

/** The screen for an unknown route or a record that no longer exists. */
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

/** Shown in place of a screen whose data failed to load (bad link, deleted game). The shell stays. */
export function ErrorScreen({ error }: { error: unknown }) {
  const report = useReportError();
  useEffect(() => report(error, "render"), [error, report]);
  const message = error instanceof Error ? error.message : "";
  return (
    <Page title="Something went wrong">
      <EmptyState
        size="page"
        icon={TriangleAlert}
        title="This screen could not load"
        description={
          message.includes("not found")
            ? "It may have been deleted, or the link is wrong."
            : "Try again in a moment."
        }
        action={
          <Button asChild variant="primary">
            <Link to="/">Back home</Link>
          </Button>
        }
      />
    </Page>
  );
}

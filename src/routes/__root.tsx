import { createRootRoute } from "@tanstack/react-router";
import { SeasonProvider } from "@/app/season";
import { AppShell } from "@/app/shell/AppShell";
import { NotFoundScreen } from "@/app/shell/StatusScreens";

export const Route = createRootRoute({
  component: () => (
    <SeasonProvider>
      <AppShell />
    </SeasonProvider>
  ),
  notFoundComponent: NotFoundScreen,
});

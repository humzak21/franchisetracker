import { ConvexProvider, ConvexReactClient } from "convex/react";
import type { ReactNode } from "react";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/design/theme";
import { FranchiseProvider, useFranchise } from "./franchise";
import { KeyboardProvider } from "./keyboard";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!url) throw new Error("VITE_CONVEX_URL is not set. Run `npx convex dev` once to create .env.local.");
export const convex = new ConvexReactClient(url);

/** Theme follows the franchise's team, so it sits inside the franchise data. */
function TeamTheme({ children }: { children: ReactNode }) {
  const active = useFranchise();
  return <ThemeProvider team={active?.userTeam}>{children}</ThemeProvider>;
}

/** Providers that do not depend on the router. Router-aware providers live in the root route. */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexProvider client={convex}>
      <FranchiseProvider>
        <TeamTheme>
          <TooltipProvider delayDuration={300}>
            <KeyboardProvider>{children}</KeyboardProvider>
          </TooltipProvider>
        </TeamTheme>
      </FranchiseProvider>
    </ConvexProvider>
  );
}

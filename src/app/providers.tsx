import { ConvexAuthProvider } from "@convex-dev/auth/react";
import { ConvexReactClient, useQuery } from "convex/react";
import type { ReactNode } from "react";
import { api } from "@convex/_generated/api";
import { TeamLogosProvider } from "@/components/team/TeamLogos";
import { TooltipProvider } from "@/components/ui/tooltip";
import { ThemeProvider } from "@/design/theme";
import { AuthGate } from "./auth/AuthGate";
import { FranchiseProvider, useFranchise } from "./franchise";
import { KeyboardProvider } from "./keyboard";
import { FranchiseGate } from "./setup/FranchiseGate";

const url = import.meta.env.VITE_CONVEX_URL as string | undefined;
if (!url) throw new Error("VITE_CONVEX_URL is not set. Run `npm run use:local` once to create .env.local.");
export const convex = new ConvexReactClient(url);

/** Theme follows the franchise's team, so it sits inside the franchise data. */
function TeamTheme({ children }: { children: ReactNode }) {
  const active = useFranchise();
  return <ThemeProvider team={active?.userTeam}>{children}</ThemeProvider>;
}

const NO_LOGOS: Record<string, string> = {};

/** Cached ESPN logos for every `TeamLogo`; monograms until they load (or if never cached). */
function TeamLogos({ children }: { children: ReactNode }) {
  const logos = useQuery(api.league.logos.urls, {});
  return <TeamLogosProvider value={logos ?? NO_LOGOS}>{children}</TeamLogosProvider>;
}

/**
 * Providers that do not depend on the router. Everything below the AuthGate, including
 * every Convex query, exists only for the signed-in owner.
 */
export function AppProviders({ children }: { children: ReactNode }) {
  return (
    <ConvexAuthProvider client={convex}>
      <AuthGate>
        <FranchiseProvider>
          <TeamTheme>
            <TeamLogos>
              <TooltipProvider delayDuration={300}>
                <KeyboardProvider>
                  <FranchiseGate>{children}</FranchiseGate>
                </KeyboardProvider>
              </TooltipProvider>
            </TeamLogos>
          </TeamTheme>
        </FranchiseProvider>
      </AuthGate>
    </ConvexAuthProvider>
  );
}

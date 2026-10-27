import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "@/design/theme";
import { useOnline } from "@/lib/hooks/useOnline";
import { clearQueryCache, hasCachedQueries } from "@/lib/offline/queryCache";
import { markSignInComplete, SignInScreen } from "./SignInScreen";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" aria-busy="true" aria-label="Loading">
      <img src="/favicon.svg" alt="" className="size-14 animate-pulse rounded-2xl" />
    </div>
  );
}

/** Signed out with a connection: whatever this device cached belongs to the last session. */
function SignedOut() {
  useEffect(() => void clearQueryCache(), []);
  return <SignInScreen />;
}

function SignedIn({ children }: { children: ReactNode }) {
  useEffect(markSignInComplete, []);
  return <>{children}</>;
}

/**
 * Renders the app only for a signed-in owner; everyone else gets the sign-in screen. With no
 * connection the session cannot be checked, so a device that has cached screens from a signed-in
 * session shows them read-only (FEATURES.md 5.13) instead of waiting on the splash.
 */
export function AuthGate({ children }: { children: ReactNode }) {
  const online = useOnline();
  if (!online && hasCachedQueries()) return <>{children}</>;
  return (
    <>
      <AuthLoading>
        <ThemeProvider>
          <Splash />
        </ThemeProvider>
      </AuthLoading>
      <Unauthenticated>
        <ThemeProvider>
          <SignedOut />
        </ThemeProvider>
      </Unauthenticated>
      <Authenticated>
        <SignedIn>{children}</SignedIn>
      </Authenticated>
    </>
  );
}

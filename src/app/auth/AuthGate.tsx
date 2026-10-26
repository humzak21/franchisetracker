import { Authenticated, AuthLoading, Unauthenticated } from "convex/react";
import { useEffect, type ReactNode } from "react";
import { ThemeProvider } from "@/design/theme";
import { markSignInComplete, SignInScreen } from "./SignInScreen";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" aria-busy="true" aria-label="Loading">
      <img src="/favicon.svg" alt="" className="size-14 animate-pulse rounded-2xl" />
    </div>
  );
}

function SignedIn({ children }: { children: ReactNode }) {
  useEffect(markSignInComplete, []);
  return <>{children}</>;
}

/** Renders the app only for a signed-in owner; everyone else gets the sign-in screen. */
export function AuthGate({ children }: { children: ReactNode }) {
  return (
    <>
      <AuthLoading>
        <ThemeProvider>
          <Splash />
        </ThemeProvider>
      </AuthLoading>
      <Unauthenticated>
        <ThemeProvider>
          <SignInScreen />
        </ThemeProvider>
      </Unauthenticated>
      <Authenticated>
        <SignedIn>{children}</SignedIn>
      </Authenticated>
    </>
  );
}

import { useAuthActions } from "@convex-dev/auth/react";
import { useQuery } from "convex/react";
import { FlaskConical, Lock, Triangle } from "lucide-react";
import { useState } from "react";
import { api } from "@convex/_generated/api";
import { Button } from "@/components/ui/button";

/** Set before redirecting to Vercel; still set on return means the sign-in was refused. */
const PENDING_KEY = "ft.signin.pending";

export function markSignInComplete() {
  try {
    sessionStorage.removeItem(PENDING_KEY);
  } catch {
    // Storage unavailable: nothing to clear.
  }
}

function readPending(): boolean {
  try {
    return sessionStorage.getItem(PENDING_KEY) !== null;
  } catch {
    return false;
  }
}

/** The only screen a signed-out visitor sees. Nothing else in the app renders before sign-in. */
export function SignInScreen() {
  const { signIn } = useAuthActions();
  const info = useQuery(api.account.authInfo, {});
  const [refused] = useState(readPending);
  const [busy, setBusy] = useState<"vercel" | "test" | null>(null);
  const [error, setError] = useState<string | null>(null);

  const signInWithVercel = async () => {
    setBusy("vercel");
    try {
      sessionStorage.setItem(PENDING_KEY, "1");
    } catch {
      // Without storage we simply cannot show the refused hint.
    }
    await signIn("vercel");
  };

  const signInAsTestOwner = async () => {
    setBusy("test");
    setError(null);
    try {
      await signIn("test");
    } catch {
      setError("Test sign-in is not enabled on this deployment.");
      setBusy(null);
    }
  };

  return (
    <main
      className="pt-safe pb-safe grid min-h-dvh place-items-center bg-team px-4 text-team-foreground"
      style={{
        backgroundImage:
          "radial-gradient(120% 90% at 100% 0%, color-mix(in oklch, var(--team-secondary) 45%, transparent), transparent 60%), linear-gradient(180deg, rgb(255 255 255 / 0.05), rgb(0 0 0 / 0.35))",
      }}
    >
      <div className="shadow-elevated w-full max-w-sm animate-rise-in rounded-2xl border border-white/15 bg-black/25 p-6 backdrop-blur-xl sm:p-8">
        <img src="/favicon.svg" alt="" className="size-14 rounded-2xl" />
        <h1 className="mt-5 font-display text-4xl leading-none font-bold tracking-wide uppercase">
          FranchiseTracker
        </h1>
        <p className="mt-2 flex items-center gap-1.5 text-sm opacity-75">
          <Lock className="size-3.5" /> Private. Sign in to continue.
        </p>

        {refused && (
          <p role="alert" className="mt-5 rounded-lg bg-white/10 px-3 py-2 text-sm">
            That sign-in did not complete. Only the owner&apos;s Vercel account can use this app.
          </p>
        )}

        <div className="mt-6 space-y-2">
          <Button
            size="lg"
            className="w-full bg-white text-black hover:bg-white/90"
            onClick={signInWithVercel}
            disabled={busy !== null}
          >
            <Triangle className="fill-current" />{" "}
            {busy === "vercel" ? "Redirecting to Vercel…" : "Sign in with Vercel"}
          </Button>
          {info?.testSignIn && (
            <Button
              size="lg"
              variant="ghost"
              className="w-full text-team-foreground/80 hover:bg-white/10 hover:text-team-foreground"
              onClick={signInAsTestOwner}
              disabled={busy !== null}
            >
              <FlaskConical /> Sign in as test owner (local)
            </Button>
          )}
        </div>
        {error && <p className="mt-3 text-sm text-red-200">{error}</p>}
      </div>
    </main>
  );
}

import { useAuthActions } from "@convex-dev/auth/react";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { FranchiseForm, labelClass } from "./FranchiseForm";

/** First-run franchise setup (FEATURES.md 5.0), shown instead of every screen until a franchise exists. */
export function FranchiseSetup() {
  const { signOut } = useAuthActions();
  return (
    <main className="pt-safe pb-safe min-h-dvh bg-background">
      <FranchiseForm
        stickyBar
        className="mx-auto max-w-3xl px-4 py-8 sm:px-6 sm:py-12"
        header={(team) => (
          <header className="flex items-center gap-4">
            {team ? (
              <TeamLogo team={team} size="lg" />
            ) : (
              <img src="/favicon.svg" alt="" className="size-14 rounded-2xl" />
            )}
            <div>
              <p className={labelClass}>New franchise</p>
              <h1 className="font-display text-4xl leading-none font-bold tracking-wide uppercase">
                {team ? `${team.city} ${team.name}` : "Pick your team"}
              </h1>
            </div>
          </header>
        )}
        actions={
          <Button variant="ghost" size="sm" onClick={() => void signOut()}>
            Sign out
          </Button>
        }
      />
    </main>
  );
}

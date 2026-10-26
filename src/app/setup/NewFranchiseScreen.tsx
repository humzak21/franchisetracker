import { Link, useNavigate } from "@tanstack/react-router";
import { Shield } from "lucide-react";
import { Page } from "@/components/layout/Page";
import { TeamLogo } from "@/components/team/TeamLogo";
import { Button } from "@/components/ui/button";
import { FranchiseForm, labelClass } from "./FranchiseForm";

/**
 * Another franchise, from Settings or the franchise switcher. It becomes the active one as soon as
 * it is created, with its own real NFL history import; the others keep their data.
 */
export function NewFranchiseScreen() {
  const navigate = useNavigate();
  return (
    <Page title="New franchise" back={{ to: "/settings", label: "Settings" }}>
      <FranchiseForm
        className="mx-auto max-w-3xl"
        onCreated={() => void navigate({ to: "/" })}
        header={(team) => (
          <div className="flex items-center gap-4">
            {team ? (
              <TeamLogo team={team} size="lg" />
            ) : (
              <span className="grid size-14 shrink-0 place-items-center rounded-2xl border border-dashed border-border-strong text-subtle-foreground">
                <Shield className="size-6" />
              </span>
            )}
            <div className="min-w-0">
              <p className={labelClass}>Team</p>
              <p className="truncate font-display text-3xl leading-none font-bold tracking-wide uppercase">
                {team ? `${team.city} ${team.name}` : "Pick a team"}
              </p>
              <p className="mt-1 text-sm text-muted-foreground">
                Your other franchises stay as they are; switch back any time from the franchise menu.
              </p>
            </div>
          </div>
        )}
        actions={
          <Button asChild variant="ghost" size="sm">
            <Link to="/settings">Cancel</Link>
          </Button>
        }
      />
    </Page>
  );
}

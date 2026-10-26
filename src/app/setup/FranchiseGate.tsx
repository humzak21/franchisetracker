import type { ReactNode } from "react";
import { useFranchise } from "../franchise";
import { FranchiseSetup } from "./FranchiseSetup";

function Splash() {
  return (
    <div className="grid min-h-dvh place-items-center bg-background" aria-busy="true" aria-label="Loading">
      <img src="/favicon.svg" alt="" className="size-14 animate-pulse rounded-2xl" />
    </div>
  );
}

/** Every screen needs a franchise; until one exists the owner sees setup instead. */
export function FranchiseGate({ children }: { children: ReactNode }) {
  const active = useFranchise();
  if (active === undefined) return <Splash />;
  if (active === null) return <FranchiseSetup />;
  return <>{children}</>;
}

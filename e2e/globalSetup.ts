import { execFileSync } from "node:child_process";
import { realpathSync } from "node:fs";

const PORTS = { 3210: "Convex backend", 3299: "backend readiness", 5174: "app build" } as const;

/** The folder a listening port's process runs in, or null when nothing is listening. */
function ownerFolder(port: string): string | null {
  const lsof = (...args: string[]) => {
    try {
      return execFileSync("lsof", ["-nP", ...args], { encoding: "utf8" });
    } catch {
      return ""; // lsof exits non-zero when it finds nothing.
    }
  };
  const pid = lsof("-t", `-iTCP:${port}`, "-sTCP:LISTEN").split("\n")[0];
  if (!pid) return null;
  return lsof("-a", "-p", pid, "-d", "cwd", "-Fn").match(/^n(.+)$/m)?.[1] ?? null;
}

/**
 * Playwright reuses whatever already listens on these ports, so a run started while another
 * checkout's is going would test that build and write into that run's data. Stops it instead.
 */
export default function globalSetup() {
  if (process.env.CI) return;
  const here = realpathSync(process.cwd());
  const foreign = Object.entries(PORTS).flatMap(([port, what]) => {
    const folder = ownerFolder(port);
    return folder !== null && folder !== here ? [`port ${port} (${what}) is held by ${folder}`] : [];
  });
  if (foreign.length > 0) {
    throw new Error(
      `Another checkout's test stack is running, and this run would use it:\n  ${foreign.join("\n  ")}\n` +
        "Wait for it to finish or stop it, then run this again.",
    );
  }
}

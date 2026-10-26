/** Error reporting helpers shared by the browser reporter and the Convex mutation. Pure. */

/**
 * Groups repeats of one error: the message with numbers and ids blanked, plus the first stack
 * frame without its line and column (which move with every build).
 */
export function errorFingerprint(message: string, stack?: string): string {
  const normalized = message.replace(/\b[0-9a-z]{20,}\b/gi, "#").replace(/\d+/g, "#");
  const frame =
    stack
      ?.split("\n")
      .map((line) => line.trim())
      .find((line) => line.startsWith("at ") || line.includes("@"))
      ?.replace(/:\d+:\d+\)?$/, "")
      .replace(/[?#].*$/, "") ?? "";
  return `${normalized}|${frame}`.slice(0, 300);
}

/**
 * Errors the app raises on purpose (a deleted record, invalid input, a signed-out session) are
 * shown to the user and are not bugs; everything else is reported.
 */
export function isExpectedError(error: unknown): boolean {
  if (typeof error !== "object" || error === null) return false;
  const data = (error as { data?: unknown }).data;
  if (typeof data === "object" && data !== null && "code" in data) {
    return ["not_found", "invalid", "conflict", "unauthorized", "unauthenticated", "forbidden"].includes(
      String((data as { code: unknown }).code),
    );
  }
  return false;
}

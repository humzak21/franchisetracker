import { ConvexError } from "convex/values";

/** The message a Convex app error carries (`convex/lib/errors.ts`), or a fallback for anything else. */
export function errorMessage(error: unknown, fallback: string): string {
  if (error instanceof ConvexError) {
    const data = error.data as { message?: unknown } | string;
    if (typeof data === "string") return data;
    if (typeof data.message === "string") return data.message;
  }
  return fallback;
}

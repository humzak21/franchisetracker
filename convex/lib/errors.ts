/**
 * Typed application errors. `ConvexError` payloads reach the client intact
 * (unlike plain `Error` messages, which are redacted in production), so the UI
 * can branch on `code`.
 */
import { ConvexError } from "convex/values";

export type AppErrorCode = "not_found" | "invalid" | "conflict" | "unauthorized";

export type AppErrorData = { code: AppErrorCode; message: string };

export function appError(code: AppErrorCode, message: string): ConvexError<AppErrorData> {
  return new ConvexError({ code, message });
}

export function notFound(what: string): ConvexError<AppErrorData> {
  return appError("not_found", `${what} not found`);
}

export function invalid(message: string): ConvexError<AppErrorData> {
  return appError("invalid", message);
}

/** Narrows a nullable document, throwing a `not_found` error when missing. */
export function must<T>(value: T | null | undefined, what: string): T {
  if (value === null || value === undefined) throw notFound(what);
  return value;
}

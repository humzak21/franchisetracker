import { useMutation } from "convex/react";
import { useCallback } from "react";
import { api } from "@convex/_generated/api";
import { isExpectedError } from "@shared/ops/errors";

type Kind = "render" | "error" | "rejection";

/** Reports sent per minute at most, so a render loop cannot flood the backend. */
const PER_MINUTE = 10;
const sent: number[] = [];

/** Browser noise that is not a bug in the app. */
const IGNORED = [/ResizeObserver loop/, /^Script error\.?$/];

/**
 * Sends an unexpected error to Settings → Errors (FEATURES.md 8). Expected app errors (deleted
 * records, invalid input) and known browser noise are skipped; reporting never throws.
 */
export function useReportError() {
  const send = useMutation(api.ops.errors.report);
  return useCallback(
    (error: unknown, kind: Kind) => {
      if (isExpectedError(error)) return;
      const message = error instanceof Error ? error.message : String(error);
      if (IGNORED.some((pattern) => pattern.test(message))) return;
      const now = Date.now();
      while (sent.length > 0 && now - sent[0]! > 60_000) sent.shift();
      if (sent.length >= PER_MINUTE) return;
      sent.push(now);
      send({
        kind,
        message,
        stack: error instanceof Error ? error.stack : undefined,
        path: window.location.pathname,
        userAgent: navigator.userAgent,
      }).catch(() => {
        // Offline or signed out: the error is lost rather than raising another one.
      });
    },
    [send],
  );
}

/**
 * Rate limits for the one unauthenticated surface, the Shortcut endpoint (FEATURES.md 8). One
 * owner sends a handful of captures at a time, so the limits sit well above real use and well
 * below anything that could fill storage or burn extraction credits.
 */
import { HOUR, MINUTE, RateLimiter } from "@convex-dev/rate-limiter";
import { components } from "../_generated/api";

export const rateLimiter = new RateLimiter(components.rateLimiter, {
  /** Every request with a valid token: a burst of 20 (a season of screenshots), then one every 2 s. */
  shortcutRequests: { kind: "token bucket", rate: 30, period: MINUTE, capacity: 20 },
  /** Requests with a missing, wrong or revoked token, across all callers; never blocks a valid token. */
  shortcutBadTokens: { kind: "fixed window", rate: 20, period: HOUR },
});

import rateLimiter from "@convex-dev/rate-limiter/convex.config.js";
import { defineApp } from "convex/server";

const app = defineApp();
// Rate limits for the Shortcut endpoint (convex/lib/rateLimits.ts).
app.use(rateLimiter);

export default app;

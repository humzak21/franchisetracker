import { fileURLToPath, URL } from "node:url";
import { defineConfig } from "vitest/config";

const path = (relative: string) => fileURLToPath(new URL(relative, import.meta.url));
const alias = { "@": path("./src"), "@shared": path("./shared"), "@convex": path("./convex") };

export default defineConfig({
  test: {
    projects: [
      {
        resolve: { alias },
        test: {
          name: "unit",
          include: ["shared/**/*.test.ts", "src/**/*.test.{ts,tsx}", "audit/**/*.test.ts"],
          environment: "node",
        },
      },
      {
        resolve: { alias },
        test: {
          name: "convex",
          include: ["convex/**/*.test.ts"],
          environment: "edge-runtime",
          server: { deps: { inline: ["convex-test"] } },
          // A history import ends with a records build: a second or two alone, more when every file runs at once.
          testTimeout: 30_000,
        },
      },
    ],
  },
});

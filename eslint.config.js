import js from "@eslint/js";
import reactHooks from "eslint-plugin-react-hooks";
import globals from "globals";
import tseslint from "typescript-eslint";

const CONVEX_USE_QUERY = {
  name: "convex/react",
  importNames: ["useQuery"],
  message: "Import useQuery from @/lib/convex/useQuery: it keeps results for reading offline.",
};

export default tseslint.config(
  {
    ignores: [
      "dist",
      "dev-dist",
      "coverage",
      "convex/_generated",
      "src/routeTree.gen.ts",
      ".agents",
      ".claude",
    ],
  },
  {
    extends: [js.configs.recommended, ...tseslint.configs.recommended],
    files: ["**/*.{ts,tsx}"],
    languageOptions: { ecmaVersion: 2023, globals: globals.browser },
    plugins: { "react-hooks": reactHooks },
    rules: {
      ...reactHooks.configs.recommended.rules,
      "@typescript-eslint/no-unused-vars": ["error", { argsIgnorePattern: "^_", varsIgnorePattern: "^_" }],
      "@typescript-eslint/consistent-type-imports": "error",
      "max-lines": ["warn", { max: 300, skipBlankLines: true, skipComments: true }],
    },
  },
  {
    // Playwright fixtures pass a `use` callback that is not a React hook.
    files: ["e2e/**/*.ts", "playwright.config.ts"],
    languageOptions: { globals: globals.node },
    rules: { "react-hooks/rules-of-hooks": "off" },
  },
  {
    // Screens read through the offline-aware wrapper (src/lib/convex/useQuery.ts).
    files: ["src/**/*.{ts,tsx}"],
    ignores: ["src/lib/convex/useQuery.ts"],
    rules: { "no-restricted-imports": ["error", { paths: [CONVEX_USE_QUERY] }] },
  },
  {
    // Layering rule from FEATURES.md 2.1: features never import from each other.
    files: ["src/features/**/*.{ts,tsx}"],
    rules: {
      "no-restricted-imports": [
        "error",
        {
          paths: [CONVEX_USE_QUERY],
          patterns: [
            {
              group: ["@/features/*"],
              message:
                "Features must not import from other features; move shared code down to components/ or lib/.",
            },
          ],
        },
      ],
    },
  },
);

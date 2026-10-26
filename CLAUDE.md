# FranchiseTracker: working rules

A Football Manager style front end for a Madden franchise. Single user, Convex backend, one responsive React app that is a full client on both the Mac and the iPhone.

- **Product spec (source of truth):** `docs/FEATURES.md`. **Build order:** `docs/SPRINTS.md`. Read the sprint you are working on before writing code, and keep both docs current when scope changes.
- **Source data:** the original workbook (`Madden 26 Pats.xlsx`) is a one-time import source, not a runtime dependency.

## Commands

| Task | Command |
|---|---|
| Install | `npm install` |
| Dev (Convex + Vite together) | `npm run dev` (Vite on http://localhost:5173, `convex dev` pushes functions on save) |
| Front end only (backend already pushed) | `npm run dev:frontend` |
| Seed a fresh deployment | `npm run seed` (idempotent) |
| Everything a PR must pass | `npm run check` (typecheck app + Convex, lint, tests) |
| Format | `npm run format` (Prettier with the Tailwind class sorter) |
| Production build, served locally | `npm run build && npm run preview` |
| Deploy production | Push to `main`. Vercel builds with `npm run deploy` (from `vercel.json`), which runs `convex deploy` with `CONVEX_DEPLOY_KEY` and builds the front end against the production URL. Run it locally only with the user's go-ahead. |

Environment: `.env.local` (git-ignored, written by `convex dev`) holds `CONVEX_DEPLOYMENT`, `VITE_CONVEX_URL` and `VITE_CONVEX_SITE_URL`. The dev deployment is `prestigious-iguana-83`. Never run `convex deploy`, or anything else that writes to production, without the user's explicit go-ahead. Secrets (OpenRouter key, Shortcut tokens) live in Convex env vars, never in the client or the repo.

## Architecture and layering

```
shared/     pure TypeScript: stat registry, stat math, formatters, domain enums, team seed data
convex/     backend: schema/ per domain, one folder per domain for functions, lib/ for helpers
src/
  design/      tokens.css, theme (team colors), color math
  lib/         hooks and utilities with no app knowledge
  components/  ui/ (primitives), data/, player/, team/, layout/, overlay/
  app/         providers, nav, franchise and season context, keyboard, shell
  features/    one folder per screen area (dashboard, schedule, roster, ...)
  routes/      thin TanStack file routes that render a feature screen
```

Import direction is one way: `routes → features → components → lib/design → shared`. Features may also use the app context hooks (`useFranchise`, `useSeason`, `useShortcut`).

- **Features never import from other features** (enforced by ESLint). Anything two features need moves down into `components/`, `lib/` or `shared/`.
- **Components never import from `app/` or `features/`.** When a component needs an app-level control, invert the dependency through context the way `PageChrome` does.
- **Route files stay thin:** a `createFileRoute` call and a feature screen. No logic.
- **Convex functions stay thin:** validate args, check auth, read and write data, and call into `shared/` for math. Stat math never lives in `convex/` or `src/`.

## Reuse before you write

1. **One definition per concept.** Stats come from `shared/stats/registry.ts`, enums from `shared/domain/`, nav items from `src/app/nav.ts`, design values from `src/design/tokens.css`. Never re-declare a stat label, a position list, a color or a week list somewhere else. Adding a stat or enum value is one entry in one place.
2. **Search before creating.** Before writing a component, hook or helper, check `components/`, `lib/`, `shared/` and the gallery at `/dev/components`. Extend an existing primitive with a prop before adding a near-duplicate.
3. **Compose the vocabulary.** Screens are built from `Page`, `Section`, `SplitPane`, `DataTable` + `statColumn`, `StatCell`, `StatCard`, `RankRibbon`, `RankBadge`, `Highlight`, `Sparkline`, `PlayerChip`, `TeamChip`, `TeamLogo`, `ScoreBug`, `EmptyState`, `BottomSheet`. A new primitive needs a gallery specimen in the same change.
4. **Three strikes.** The second copy of a pattern is a warning; the third gets extracted.
5. **No dead options.** Do not add props, flags or config for cases nobody uses yet.

## Keep files small and debt low

- Aim for files under 200 lines; ESLint warns at 300. Split by responsibility (a component, its hook, its pure helpers, its types) rather than letting a file grow.
- One exported component per file, named after the file. Small private helpers can live alongside it.
- Pure logic (formatting, math, mapping) goes in `shared/` or a `.ts` file next to the component, with tests. Components only render.
- No `any`, no non-null assertions on data from the network, no `// @ts-ignore`. Fix the type.
- No commented-out code, no TODOs without a sprint or an owner. A shortcut taken on purpose gets a one-line comment saying why.
- Delete code you replace in the same change. Lint, typecheck and tests stay at zero errors and zero warnings.
- Comments explain why, not what. Match the surrounding density.

## Phone parity is a release criterion

Every screen ships for phone and desktop together (FEATURES.md 5.13 and 9). There is no "make it mobile" pass later.

- **Screens never branch on viewport size; components do.** Primitives switch layout on their own width (`useElementWidth`, Tailwind container queries `@tablet:` and `@desktop:`), so a table in a narrow pane or the gallery's phone frame gets the phone layout. Only `app/shell` reads the viewport.
- Breakpoints: phone under 640 px, tablet 640 to 1024 px, desktop above. Touch targets are 44 px minimum on coarse pointers (`pointer-coarse:` variants are built into the primitives).
- Never hide a column or a capability on phones. `DataTable` keeps primary columns in the table and the rest in the tap-to-expand card.
- Before a sprint closes, check every new screen at 390 x 844 and 430 x 932 in both themes in the in-app browser, plus desktop width.

## Design system

- Use the semantic Tailwind tokens (`bg-surface`, `text-muted-foreground`, `text-primary`, `bg-win`, `bg-elite-1`). No raw hex or palette colors in components, except team colors passed as data.
- Team colors are injected at runtime from the franchise's team (`design/theme.tsx`); `primary` is the accent that reads best on the current background.
- Numbers use `num` (tabular figures). Stats render through `StatCell`/`statColumn`, never by formatting inline.
- Every data view has an intentional loading state (`Skeleton`) and an empty state (`EmptyState`). Dark is the default; the light theme gets checked too.
- Motion is 150 to 250 ms eases, none on tables, and everything respects reduced motion.

## Convex

- Read `convex/_generated/ai/guidelines.md` before touching Convex code. It overrides training-data habits.
- Schema is split per domain in `convex/schema/*.ts` and composed in `convex/schema.ts`. Enum validators come from `convex/lib/validators.ts`, which builds them from `shared/domain`.
- Indexed reads only (`withIndex`), bounded results (`take`/`paginate`), no `.filter` scans, no `.collect()` on growing tables. Aggregates are materialized so tables are one indexed read.
- Every function has argument validators; internal-only functions use `internal*`. Imports and recomputes are idempotent.
- **The whole app is private.** From Sprint 1, every public query, mutation and action starts with `requireOwner(ctx)` (Sign in with Vercel identity checked against the owner allowlist). The only unauthenticated surface is the Shortcut HTTP endpoint, which checks its bearer token. Never ship a public function without the check.
- Tests use `convex-test` under `convex/**/*.test.ts` (Vitest `convex` project, edge runtime).

## Testing and definition of done

- `npm run check` passes: `tsc` for app and Convex, ESLint, Vitest.
- New `shared/` logic has unit tests next to it (`*.test.ts`). New Convex mutations and queries have `convex-test` coverage of the happy path and the idempotency or authorization edge.
- UI changes are verified in the running app (`.claude/launch.json` config `web`) at phone and desktop widths, not only by typecheck.
- Each sprint's "Done when" in `docs/SPRINTS.md` is the bar for closing it.

## Git

- Branch per sprint or feature off `main`; small, focused commits with messages that say why.
- `convex/_generated/` and `src/routeTree.gen.ts` are generated but committed so a fresh clone typechecks; regenerate them with `npx convex dev --once` and the Vite plugin, never by hand.

<!-- convex-ai-start -->

This project uses [Convex](https://convex.dev) as its backend.

When working on Convex code, **always read
`convex/_generated/ai/guidelines.md` first** for important guidelines on
how to correctly use Convex APIs and patterns. The file contains rules that
override what you may have learned about Convex from training data.

Convex agent skills for common tasks can be installed by running
`npx convex ai-files install`.

<!-- convex-ai-end -->

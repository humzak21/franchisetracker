# Launch readiness

The checklist a release must pass (Sprint 9's "Done when"). Most of it runs in CI on every pull
request; the rest is a short list of things to run by hand before shipping to production.

## Automated (CI and `npm run check:all`)

| Check | Where |
|---|---|
| Typecheck, lint, format, build | CI, `npm run check:all` |
| Every public query and mutation calls `requireOwner`, every action `requireOwnerAction` | `audit/convex.test.ts` |
| Every Convex function validates its arguments | `audit/convex.test.ts` |
| The Shortcut endpoint checks its token and rate limit before anything else | `audit/convex.test.ts`, `convex/ingestion/ingestion.test.ts` |
| No query scans with `.filter` or reads a whole table with `.collect()` | `audit/convex.test.ts` |
| A signed-out caller and a signed-in non-owner are refused (queries, mutations, actions) | `convex/account.test.ts`, per-domain tests |
| Every table is in the backup or left out on purpose; a backup restores as an identical, separate franchise | `convex/ops/backup.test.ts` |
| Stat math, registries, extraction normalizers and validators, the import diff | `shared/**/*.test.ts` (`npm run test:coverage`: 96.7% of lines) |
| The commit and recompute path | `convex/ingestion/*.test.ts`, `convex/stats/stats.test.ts` |
| Every screen loads with no console errors and no horizontal overflow, both themes, desktop and a phone | `e2e/*.spec.ts` |
| Every control on a phone is at least 44 px (or has a 44 px hit area); reduced motion switches animation off | `e2e/touch.spec.ts` |
| Screens seen before read offline, with the offline banner | `e2e/offline.spec.ts` |

## Before a production deploy

1. `npm run check:fresh-clone`: a clone of the branch installs, starts a new local backend and
   sets up its first franchise from scratch. (Every other test runs against the seeded sample,
   so only this one catches a broken first run.)
2. Convex production env: `OWNER_EMAILS`, `AUTH_VERCEL_ID`, `AUTH_VERCEL_SECRET`,
   `JWT_PRIVATE_KEY`, `JWKS`, `SITE_URL` (docs/AUTH-SETUP.md) and `OPENROUTER_API_KEY`;
   `AUTH_TEST_MODE` must not be set.
3. Settings → Data on production after the deploy: "Back up now" succeeds and the backup's
   download link works. The nightly backup (`convex/crons.ts`) keeps the last fourteen.
4. Settings → Errors is empty, or every entry is understood.
5. On the phone (installed to the home screen): sign in, open Home, Schedule and a game, capture
   one screenshot from the photo library, and check the safe areas around the notch and home bar.

## Backups and recovery

- Nightly and on-demand backups are gzipped JSON of every franchise in Convex file storage,
  listed in Settings → Data. Download one to keep a copy off Convex.
- Restoring adds the backed-up franchises as new, inactive franchises; it never overwrites. Switch
  to the restored copy, check it, and delete whichever copy you no longer want.
- Backups leave out the screenshots in the inbox and the Shortcut tokens. For a snapshot of the
  whole deployment including file storage, use `npx convex export` (Convex's own export).
- For a scrubbed local copy of production to test against, see `docs/PROD-COPY.md`. It is not a
  backup: sign-in data and tokens are removed from it.

## Not done, on purpose

- The optional Tauri dock app (Sprint 9) was not built: the installed PWA covers the Mac and the
  phone, and a native wrapper would add a second build and signing to maintain.

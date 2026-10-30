# Local copy of production

A scrubbed copy of production's data that runs on this machine, for trying work against a full
franchise. It has no link back to production: it holds no credentials, cannot make outside calls
and is not reachable from the network.

```bash
npm run snapshot:prod   # read-only export of production, scrubbed and stored (once in a while)
npm run use:prod-copy   # load the latest snapshot into this checkout (run in each worktree)
npm run dev:prod-copy   # open it; the address is printed, sign in with the test owner button
```

`snapshot:prod` needs the Convex CLI logged in (`npx convex login`) as someone on the project.
`use:prod-copy` needs a downloaded backend: run `npm run use:local` once on the machine.
`use:prod-copy` replaces the checkout's copy, so changes you made in it are gone; that is how you
get a clean one back.

To run a Convex command on the copy, go through its folder and env file:

```bash
cd .convex/prod-copy && npx convex data players --env-file env
```

Start a new project from it with `npx convex import` on `snapshot.zip`; it holds no secrets.

## Where things live

| What | Where |
|---|---|
| Snapshots, shared by every checkout | `~/.franchisetracker/prod-snapshots/<time>/` (`snapshot.zip`, `manifest.json`) |
| One checkout's copy | `.convex/prod-copy/` (git-ignored) |
| The address the copy's Vite uses | `.env.prod-copy.local` (git-ignored) |

Snapshots are about 270 MB each and are not pruned. Delete old folders when you no longer want them.

## How it is built

**Convex's export, not the app's backup.** The backup (`shared/ops/backup.ts`) leaves out uploads,
file storage and the worked-out boards, restores under new ids as an extra inactive franchise, and
running one writes a row to production. `convex export` only reads, and carries every table, the
files and the original ids, so `convex import --replace-all` brings back the same app. Taking an
export does list a snapshot in the production dashboard (Settings → Snapshots); that is Convex's
own bookkeeping and changes no app data.

**It runs beside the sample backend, not instead of it.** The Convex CLI keeps one backend per
folder (`.convex/local/default`), and that one stays Playwright's. The copy has its own folder and
starts the backend binary itself, for two flags `convex dev` cannot set: `--interface 127.0.0.1`
(the default is every network interface) and `--convex-http-proxy`. `.env.local`, `npm run dev`,
`use:local` and `use:cloud` do not change. The CLI runs from `.convex/prod-copy` because `convex dev`
rewrites the `.env.local` of the folder it runs in, and that folder's `convex.json` points back
at the repository's `convex/`, so code changes push to the copy as usual.

**Ports come from the checkout's path** (`copyPorts`), so worktrees can each run a copy at once.
Two paths can land on the same slot of 300: if one reports its port is in use, stop the other.

## What keeps it from reaching production

- **Scrubbed before it is stored.** The raw export is deleted when `snapshot:prod` ends, pass or
  fail. Only tables the backup lists classify are kept, minus `SCRUBBED_TABLES`
  (`shared/ops/prodCopy.ts`): `users` and all of Convex Auth's tables (accounts, sessions, refresh
  tokens, codes, verifiers), `ingestionTokens`, `errorReports` and `backups` with their files. A
  table nobody has classified is left out with a warning. Rate limiter rows are cleared.
- **Scanned before it is kept.** The snapshot is refused if any row still holds a Convex or Vercel
  URL, an email address, an API key, a bearer token or a signed token.
- **No production settings.** Env vars are not part of an export. The copy has only its own JWT
  keys, `SITE_URL` and `AUTH_TEST_MODE`, and `use:prod-copy` stops if it finds anything else. There
  is no `OWNER_EMAILS`, so only the local test owner can sign in, and no OpenRouter key or Vercel
  sign-in. Every script drops `CONVEX_*` from the environment first, so a deploy key in a shell
  cannot pick the target.
- **No way out.** An action's `fetch` goes through a gate in the copy's own process that forwards
  only to the copy's own site, which the backend needs to check sign-in. nflverse, ESPN and OpenRouter
  all fail. So does anything else, and with the gate gone a fetch fails outright. Extraction
  answers with the local sample box score, as it does on any local backend without a key. The
  browser still loads the few headshot images stored as ESPN CDN links.
- **Nothing left running.** Exports carry no scheduled functions, so no production job continues
  here. Rows caught mid-job are settled so they do not hang: running imports and extractions become
  failed, and a running records build is dropped. The nightly backup cron runs while the copy is
  open, and only writes to the copy.

## Why Playwright cannot touch it

- `.env.e2e` fixes the test build on port 3210, whatever `.env.local` says.
- `copyPorts` cannot return a port tests use, so a copy is never the backend tests would reuse.
- If a copy were started on 3210 by hand, `scripts/e2e-backend.mjs` asks the backend its instance
  name and refuses before it seeds or sets anything.
- The tests' data lives in `.convex/local/default`, the copy's in `.convex/prod-copy`.

`audit/prodCopy.test.ts` checks all of this and that the only production command is the export.

## If a load fails

`convex import` validates against the checkout's schema. A snapshot imports into a schema with
extra tables, which stay empty, and into a schema missing a table the snapshot has. A branch that tightens a field production's rows do not meet stops
with the row and field named; that is the migration telling you what it needs.

If `snapshot:prod` says a table was not classified, the table is missing from
`shared/ops/backup.ts`, or this checkout is behind `main`. Update it and take the snapshot again.

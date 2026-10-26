# FranchiseTracker — Sprint Plan

Each sprint is a self-contained chunk that ends with something usable and demoable. Sprints are ordered so the app becomes genuinely useful by the end of Sprint 2 (you can log this week's game from a photo) and the remaining sprints deepen it. Every sprint has a definition of done; a sprint is not done until the screens look finished, with real data, empty states, and loading states.

Sizing: S is a focused session, M is one to two sessions, L is two to three sessions.

---

## Sprint 0 — Foundation and design system (M)

**Goal:** empty but beautiful app shell on a real Convex deployment, with the shared layers that every later sprint builds on.

- Reset the repository: remove the Xcode scaffold and the old remote contents, keep the Convex deployment config, add `.gitignore`, `README.md`, `docs/`.
- Scaffold Vite, React 19, TypeScript strict, Tailwind v4, shadcn/ui, TanStack Router with file-based routes, Convex React client, ESLint and Prettier, Vitest.
- `shared/` package: stat registry with every stat from the workbook (passing, rushing, receiving, defense, kicking, punting, returns), stat math (passer rating, averages, per game, pace), formatters, thresholds, domain enums (positions, position groups, week keys, acquisition types, award types, playoff rounds).
- Convex schema v1 for every domain in `FEATURES.md` section 4, split per domain and composed. Seed all 32 teams with colors and divisions. Create one franchise and its seasons 2025 to 2034 as empty shells.
- App shell: team-colored sidebar, top bar with season switcher, command palette stub, keyboard shortcut provider, theme tokens, light and dark.
- Primitive components: `Page`, `Section`, `SplitPane`, `DataTable` with `StatCell`, `PlayerChip`, `TeamChip`, `TeamLogo`, `ScoreBug`, `RankBadge`, `Highlight`, `EmptyState`, `Sparkline`.
- Storybook-free component gallery route (`/dev/components`) to iterate on aesthetics with fixture data.
- Deploy the front end and confirm the phone can open it.

**Done when:** the shell runs against Convex, every primitive is rendered in the gallery with fixture data in both themes, and `tsc`, lint and tests pass.

---

## Sprint 1 — Import the workbook and read it beautifully (L)

**Goal:** all ten seasons from the spreadsheet in the database, viewable on the core read screens.

- `scripts/import-xlsx`: parse Home, Reporting, Schedule, Roster, Player Stats, League Stats, Awards, Draft History. Resolve players into entities with alias handling (name variants, jersey changes). Parse the free-text stars into player references with the stat line kept as a caption. Split "27.3 - T-3rd" into value, rank and tie. Split acquisition strings. Idempotent: re-running updates rather than duplicates.
- Season-level stats from the workbook land in `seasonPlayerStats` flagged `source: import` so they coexist with log-derived totals until games are backfilled.
- Schedule screen: week list with results, byes, playoff rows, stars as chips, notes preview; season switcher wired.
- Game detail v1: score bug, stars, notes editor, opponent record, head-to-head panel. Box score section shows the empty state that invites a screenshot.
- Roster screen: grouped table with position filter, sort, search, acquisition and grade note; season switcher.
- Player page v1: hero, roster history, career stats table from imported season stats with totals row, notes.
- History home: generated decade grids, totals, trophy room with real-history entries editable.

**Done when:** every season from the workbook is browsable, player pages for Maye, Diggs and Henderson look right, and nothing in the import is lossy (a diff script compares workbook cells to database rows).

---

## Sprint 2 — Ingestion v1: this week's game from a photo (L)

**Goal:** the weekly loop works end to end from the phone.

- Convex file storage upload mutation, `uploads` and `extractions` tables, inbox screen with thumbnails, tags, status and batch select.
- HTTP endpoint for the Shortcut with bearer token auth, multipart image upload, target and week fields. Token management in Settings. Apple Shortcut built and documented in `docs/SHORTCUT.md`, with a download link in Settings.
- Web upload on the phone and drag-drop or paste on the Mac, plus the "Import screenshot" button on game detail that pre-tags the upload.
- Ingestion target registry with the first two targets: game result plus box score (multi-image), and team game stats. JSON schemas generated from the stat registry.
- OpenRouter action: prompt template per target, structured output, primary and fallback model, validation rules, per-field confidence, player name resolution against the season roster with fuzzy matching.
- Review screen: image and draft side by side, warnings highlighted, player picker for ambiguous names, commit, reject, re-run. Duplicate detection per game.
- Commit mutation: writes `games`, `gameStatLines`, `gameTeamStats`; recomputes `seasonPlayerStats` and `careerPlayerStats` for the affected players; stores corrections.
- Game detail v2: full box score grouped by category, team toggle (ours, theirs, both), highlights from thresholds, team stat comparison bars.

**Done when:** you take photos of a Madden box score on your phone, run the Shortcut, review on the Mac, commit, and the game, box score, player season totals and player pages all update live.

---

## Sprint 3 — Stats, highlights, records (M)

**Goal:** every number the spreadsheet computed by hand is now derived and better.

- Season stats screen by position group with registry-driven columns, per-game averages, threshold-game counts, best-game columns and totals row; elite highlighting tiers with configurable thresholds in Settings.
- Records engine: single game, season and career records per stat with incremental recompute on commit; records book screen; "record broken" milestones.
- Streaks engine: team and player streaks; shown on dashboard and player pages.
- All-time leaders: career top 10 per stat within the franchise.
- Milestones detection (career highs, 100-yard games, first 1000-yard season) with dashboard feed and acknowledge.
- Postseason split toggle everywhere stats appear.

**Done when:** season stats for an imported season match the workbook, a committed game moves the records and leaders, and highlights render in both themes.

---

## Sprint 4 — Players and faces (M)

**Goal:** player pages feel like a card collection.

- ESPN action: search by name, fetch headshot and bio for real players, cache in storage, user confirms the match from the player page or in bulk from the roster. Team logos from ESPN cached and used in `TeamLogo`.
- Monogram card generator for fictional players in team colors.
- OVR progression chart across seasons and in-season snapshots; dev trait and abilities on the roster entry.
- Compare screen for two to four players with shared stat keys and a radar.
- Identity tools: merge duplicates, aliases, bulk rename from a correction.
- Game log per season on the player page with highlight markers.
- Players index with search, filters and sort by position, OVR, age, seasons with the team.

**Done when:** real players show headshots, fictional ones show monogram cards, Maye's OVR line spans 2025 onward, and compare works.

---

## Sprint 5 — Season reporting, history, Hall of Fame (M)

**Goal:** the narrative layer the spreadsheet's Reporting tab was for, done properly.

- Season lifecycle: statuses, advance-season action, Super Bowl week detection.
- Pre-season prompt on season start that persists on the dashboard until answered; post-season prompt after the Super Bowl week; around-the-league notes; needs checklist with priority, carried into the offseason and resolvable by a transaction or draft pick.
- Season reports archive with the computed season summary next to each report.
- Hall of Fame: jersey wall, induction flow from any player page, retired numbers, blurb, career summary cache.
- Narrative timeline across games, seasons, awards and transactions with filters.
- Coaching staff and scheme per season, shown in the decade grid and season header.

**Done when:** advancing to a new season triggers the prompt, the prompt survives dismissal, needs flow into the next offseason, and the HoF wall looks worthy of hanging a jersey.

---

## Sprint 6 — Ingestion v2: every other screen (L)

**Goal:** no more hand entry at the end of a season.

- New targets in the registry: season player stats per position group, league leaders top 20, team season stats, standings, weekly awards, yearly awards, draft results, roster page, transactions, injury report, player card.
- Multi-image sets with merge rules (same target, same context, union of rows).
- Correction memory: corrections stored per target and injected as few-shot examples; a Settings panel shows them and lets you prune.
- Reconciliation view: season totals from a season screenshot vs totals derived from game logs, with differences highlighted and one-click acceptance of the log-derived number or a flag to find the missing game.
- Shortcut menu regenerated from the registry; context inference (current season and week by default).
- Usage and cost panel: tokens, latency and model per extraction.

**Done when:** an end-of-season pass is a batch of photos, a review session, and nothing else.

---

## Sprint 7 — League, awards, draft, transactions (M)

**Goal:** the league around the team is as rich as the team.

- Standings per season by conference and division with seeds and a playoff bracket; cumulative league table across the franchise.
- Other teams: history inside the franchise, partial rosters from observed players, draft picks.
- Awards screens: weekly grid for AFC and NFC, yearly cabinet, All-Pro and Pro Bowl lists, user-defined team awards, awards on player pages.
- Draft history, draft class retrospective grades, pick inventory, lightweight draft board linked to needs.
- Transactions log, injury report, trade tracker with retrospective notes, cap view with expiring contracts.

**Done when:** the League section answers "who won the AFC in 2029", awards and draft screens are populated for every imported season, and the cap view matches the roster.

---

## Sprint 8 — Dashboard and insights (M)

**Goal:** opening the app tells you something.

- Dashboard composed from the cards in `FEATURES.md` 5.1: season header, pending prompts, last and next game, milestones, inbox, season pulse charts, recent transactions.
- Head-to-head and rivalry views; margin-of-victory and streak charts; team rank ribbons across seasons.
- Calendar view of the season.
- Command palette with players, games, seasons, screens and actions; keyboard shortcuts sheet.

**Done when:** the dashboard is the screen you want to leave open on the second monitor.

---

## Sprint 9 — Polish, resilience, packaging (M)

**Goal:** finished product.

- Visual pass on every screen: spacing, empty and loading states, light theme, reduced motion, responsive layout down to phone width for the inbox and schedule.
- Performance: virtualized tables, indexed queries audited, aggregate recompute timed.
- Export JSON and CSV, full backup and restore, scheduled Convex backup.
- PWA manifest and icons, offline read cache; optional Tauri wrapper for a dock app with a native title bar.
- Test coverage on stat math, registry integrity, extraction validators, import diff, and the commit and recompute path with `convex-test`.
- Authorization audit (single user, token endpoint), error reporting, rate limit on the HTTP endpoint.

**Done when:** a fresh clone, `npm install`, `npx convex dev` and the import script reproduce the whole app, and the launch readiness checklist passes.

---

## Later (not scheduled)

- Scoring plays and drive charts if a Madden screen provides them cleanly.
- Multi-franchise switcher in the UI (the model already supports it).
- Shareable read-only season recap pages.
- Live Text on-device OCR as a pre-pass to improve digit accuracy.

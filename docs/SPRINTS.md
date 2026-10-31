# FranchiseTracker — Sprint Plan

Each sprint is a self-contained chunk that ends with something usable and demoable. Sprints are ordered so the app becomes genuinely useful by the end of Sprint 2 (you can log this week's game from a photo) and the remaining sprints deepen it. Every sprint has a definition of done; a sprint is not done until the screens look finished, with real data, empty states, and loading states.

Sizing: S is a focused session, M is one to two sessions, L is two to three sessions.

**Mobile parity rule.** The phone is a full client (`FEATURES.md` 5.13 and 9). Every sprint builds its screens for phone and desktop together, and a sprint's definition of done includes the phone checks listed under it. No sprint ships a desktop-only screen, and there is no "make it mobile" sprint at the end.

---

## Sprint 0 — Foundation and design system (M)

**Goal:** empty but beautiful app shell on a real Convex deployment, with the shared layers that every later sprint builds on.

- Reset the repository: remove the Xcode scaffold and the old remote contents, keep the Convex deployment config, add `.gitignore`, `README.md`, `docs/`.
- Scaffold Vite, React 19, TypeScript strict, Tailwind v4, shadcn/ui, TanStack Router with file-based routes, Convex React client, ESLint and Prettier, Vitest.
- `shared/` package: stat registry with every stat Madden box scores and season screens show (passing, rushing, receiving, defense, kicking, punting, returns), stat math (passer rating, averages, per game, pace), formatters, thresholds, domain enums (positions, position groups, week keys, acquisition types, award types, playoff rounds).
- Convex schema v1 for every domain in `FEATURES.md` section 4, split per domain and composed. Seed all 32 teams with colors and divisions.
- App shell: team-colored sidebar on desktop, bottom tab bar with a "More" sheet and floating capture button on phones, page header with back navigation and the season switcher, command palette stub, keyboard shortcut and gesture providers, theme tokens, light and dark, safe-area insets.
- Primitive components built phone-first and scaled up: `Page`, `Section`, `SplitPane` (stacks or swipes on phones), `DataTable` with `StatCell` and the phone mode from `FEATURES.md` 9 (primary and secondary columns, expandable rows, column picker, toolbar sheet), `PlayerChip`, `TeamChip`, `TeamLogo`, `ScoreBug`, `RankBadge`, `Highlight`, `EmptyState`, `Sparkline`, `StatCard`, `RankRibbon`, `BottomSheet`.
- Component gallery route (`/dev/components`) that renders every primitive at desktop and phone width side by side with fixture data.
- PWA manifest, icons, standalone display. Deploy the front end to Vercel (production deploy key in `CONVEX_DEPLOY_KEY`) and install it on the Mac and on the iPhone home screen. The deployed shell holds only the seeded teams until the login gate below lands.

**Done when:** the shell runs against Convex, every primitive is rendered in the gallery with fixture data in both themes at both widths, the app is installed on the phone, and `tsc`, lint and tests pass.

---

## Sprint 1 — Login, franchise setup and the core read screens (L)

**Goal:** a private app where a new franchise can be created and its seasons read beautifully on the core screens. There is no spreadsheet import: franchises are new, real NFL history before them comes from an external source (Sprint 4), and franchise data is captured as it is played (Sprint 2 onward).

- Login gate, before any franchise data reaches production: the whole app behind Sign in with Vercel. OIDC provider in `convex/auth.config.ts`, an owner allowlist, a `requireOwner` helper in `convex/lib/auth.ts` called by every public function, a sign-in screen that renders before the shell, and sign-out in Settings. Works the same in the installed PWA on the phone. `convex-test` covers signed-out and wrong-account calls being refused. Setup steps live in `docs/AUTH-SETUP.md`.
- Franchise setup (`FEATURES.md` 5.0): until a franchise exists, every screen shows setup instead. Name, user team from the 32, first season defaulting to the current real NFL season. Creates the franchise and its first season.
- A small sample season (`dev/fixtures:seedFixtures`) for tests, CI and empty local backends.
- Schedule screen: week list with results, byes, playoff rows, stars as chips, notes preview; season switcher wired.
- Game detail v1: score bug, stars, notes editor, opponent record, head-to-head panel. Box score section shows the empty state that invites a screenshot.
- Roster screen: grouped table with position filter, sort, search, acquisition and grade note; season switcher.
- Player page v1: hero, roster history, career stats table from season totals with a totals row, notes.
- History home: generated decade grids, totals, trophy room with editable real-history entries.
- Phone: schedule and game detail with swipe between games, roster table in phone mode with position filter in a toolbar sheet, player career table in phone mode with the totals row pinned, decade grids as stacked season cards.

**Done when:** signed out shows only the sign-in screen; a fresh deployment walks through franchise setup on the Mac and on the phone; the sample season reads cleanly on every core screen at both widths in both themes; and Playwright covers each screen.

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
- Phone: capture from camera or library straight into the inbox with target and context pickers as bottom sheets, local queue when offline, the review screen as two swipeable panes with pinch zoom and confidence-ordered fields, commit from the phone, and the box score in phone table mode with category segments.

**Done when:** you take photos of a Madden box score on your phone, run the Shortcut or the in-app capture, review and commit on either the Mac or the phone, and the game, box score, player season totals and player pages all update live on both.

**As built:**

- Targets live in `shared/ingestion/targets.ts`; each declares its schema (generated from the stat registry and a new team stat registry, `shared/stats/teamRegistry.ts`), prompt, normalizer and validator. Review editors and commit functions are keyed by target, so a new target does not typecheck until both exist.
- Commit creates the game when the week has none (franchises start without a schedule), refreshes the season record cache, creates new players and partial roster entries for names the rosters do not know, and remembers a printed name as an alias when review maps it to an existing player.
- Without `OPENROUTER_API_KEY`, a local test deployment answers extraction with a built-in sample (`convex/ingestion/fixture.ts`) so the loop can be exercised and tested end to end; cloud deployments fail the upload with the reason instead.
- Review edits autosave to the extraction, so a review survives a reload or a switch of device. Full game log is the default capture target and commits team and player stats together; offensive yards derive from passing plus rushing. Player choices are remembered per team and season, and review recommendations can be applied or approved without retyping.
- The Shortcut is built by hand from `docs/SHORTCUT.md` (Settings links to it); there is no prebuilt `.shortcut` file to download, because a signed file would carry the token. The menus come from `GET /shortcut/targets`, which is generated from the registry.
- Career-high markers in the box score wait for Sprint 3's records engine; threshold highlights ship now.

---

## Sprint 3 — Stats, highlights, records (M)

**Goal:** every number is derived from game logs, never typed.

- Season stats screen by position group with registry-driven columns, per-game averages, threshold-game counts, best-game columns and totals row; elite highlighting tiers with configurable thresholds in Settings.
- Records engine: single game, season and career records per stat with incremental recompute on commit; records book screen; "record broken" milestones.
- Streaks engine: team and player streaks; shown on dashboard and player pages.
- All-time leaders: career top 10 per stat within the franchise.
- Milestones detection (career highs, 100-yard games, first 1000-yard season) with dashboard feed and acknowledge.
- Postseason split toggle everywhere stats appear.
- Phone: season stats per position group in phone table mode with sensible primary columns per group (for example QB: comp/att, yards, TD, INT, rating), records book as cards grouped by scope, leaders as ranked lists, streaks as chips.

**Done when:** season stats derived from committed games match a hand check, a committed game moves the records and leaders, highlights render in both themes, and every stats screen is readable at phone width without losing a column.

**As built:**

- Pure engines in `shared/stats` (`records.ts`, `streaks.ts`, `milestones.ts`, `groups.ts`), unit tested. Records and leaders are one ranking: the `records` row holds the holder, the previous holder and the top ten, per split and scope, so the records book and the leaders board are each one indexed read.
- Everything counts the user team's log-derived season rows only; imported real history (Sprint 4) never mixes in. Single-game rankings take each player-season's best game, so a player's second-best game in a season is not on the single-game top ten (the record itself is exact).
- After every commit a scheduled mutation (`stats/refresh:afterGame`) rebuilds the records book (writing only changed rows), refreshes team and affected players' streaks, and syncs that game's milestones by stable key: recommitting never duplicates one, and an acknowledged milestone stays acknowledged.
- A record "falls" only to a bigger number; a correction that lowers the holder's value rewrites the record without a milestone. Win streak milestones fire at 3, 5, 8, 10, 13 and 16.
- Milestones: threshold games (except 5-catch games, which are box-score highlights only), career highs once a player has three earlier games, first season past a tier-1 threshold, franchise records and win streaks. The feed is on Home.
- The sample franchise is now built from box scores (`convex/dev/fixtureLines.ts`) rather than imported season totals, so every sample number goes through the same derivation as a real game.

---

## Sprint 4 — Real NFL history, players and faces (L)

**Goal:** the league's real past is in the app, and player pages feel like a card collection.

- Choose the real NFL history source (`FEATURES.md` 4.8; candidates: nflverse public data releases, the ESPN site API) and record the decision in `docs/` (chosen: nflverse, `docs/NFL-HISTORY.md`).
- Import for every season before the franchise's first: all 32 teams' records, standings, playoff results and titles; real players with careers and season totals up to the start; draft history. Convex actions, idempotent, run at franchise creation and refreshable from Settings. Pre-franchise seasons are marked as such on every screen that shows them.

- ESPN action: search by name, fetch headshot and bio for real players, cache in storage, user confirms the match from the player page or in bulk from the roster. Team logos from ESPN cached and used in `TeamLogo`.
- Monogram card generator for fictional players in team colors.
- OVR progression chart across seasons and in-season snapshots; dev trait and abilities on the roster entry.
- Compare screen for two to four players with shared stat keys and a radar.
- Identity tools: merge duplicates, aliases, bulk rename from a correction.
- Game log per season on the player page with highlight markers.
- Players index with search, filters and sort by position, OVR, age, seasons with the team.
- Phone: player hero and stat cards stacked with section jump links, OVR chart in its phone variant, compare as a swipeable set of player columns with a sticky stat label rail, headshot confirmation as a bottom sheet.

**Done when:** real players show headshots, fictional ones show monogram cards, a real player's page shows their pre-franchise career followed by franchise seasons, a team's history screen shows real seasons before the franchise, compare works, and the player page reads cleanly top to bottom on the phone.

**As built:**

- nflverse is the history source and ESPN the face and logo source; the decision, coverage and mechanics are in `docs/NFL-HISTORY.md`. History starts in 2002 (today's 32 teams and divisions) and includes only finished seasons; playoff results come from the playoff games because nflverse's standings file lags a season.
- The import is a chain of scheduled steps with a job row (`historyImports`) that Settings shows; every write is an upsert and a run counter supersedes old runs. It also loads all 32 teams' real first-season rosters, so box scores resolve to the imported players, and adopts players the franchise already captured under the same name. About 15,000 players and 51,000 season rows; 76 seconds on a local backend.
- Imported players carry their ESPN id from nflverse, so most never need a manual match; the ESPN search and bulk roster match are for everyone else. Headshots use ESPN's CDN until cached (the user team's first roster at import, any player when their page first opens).
- ESPN matching also searches college football, so created players from a real draft class get their college headshot, school and class; the ESPN id carries into the NFL. Bulk suggestions need the school and position to agree with an exact name.
- Dev trait and abilities moved from the player to the roster entry. In-season OVR checkpoints are logged on the player page.
- Pre-franchise seasons are `seasons` rows before `startYear`, marked in the season switcher, schedule, roster, stats, history and on the player page; records and leaders still count only log-derived rows.
- Manual headshot upload waits for a later sprint.


---

## Sprint 5 — Season reporting, history, Hall of Fame (M)

**Goal:** the narrative layer: what you thought going into and coming out of each season, and the legends.

- Season lifecycle: statuses, advance-season action, Super Bowl week detection.
- Pre-season prompt on season start that persists on the dashboard until answered; post-season prompt after the Super Bowl week; around-the-league notes; needs checklist with priority, carried into the offseason and resolvable by a transaction or draft pick.
- Season reports archive with the computed season summary next to each report.
- Hall of Fame: jersey wall, induction flow from any player page, retired numbers, blurb, career summary cache.
- Narrative timeline across games, seasons, awards and transactions with filters.
- Coaching staff and scheme per season, shown in the decade grid and season header.
- Phone: season report editors with autosave and the on-screen keyboard, needs checklist with swipe to resolve, the Hall of Fame wall as a two-column jersey grid, timeline as a single column with type filter chips.

**Done when:** advancing to a new season triggers the prompt, the prompt survives dismissal, needs flow into the next offseason, the HoF wall looks worthy of hanging a jersey, and all of it can be written and read from the phone.

**As built:**

- Lifecycle is pure logic in `shared/seasons/lifecycle.ts`. Every game commit moves the season forward from its games (first regular-season result → `regular`, a playoff game → `postseason`, a played Super Bowl → `complete`) and settles where the playoff run ended; status never moves back. A season the user team is out of, or one whose Super Bowl was not captured, is closed with "Super Bowl week done" on the Home season card (no playoff games means a missed postseason). "Start <year>" then adds the next season with the same staff, every team's roster carried over (`players/carryOver.ts`, the user team at once and each other team in its own mutation) and its pre-season report due.
- Due prompts (`shared/seasons/reports.ts`): the pre-season report of the season being played and the post-season report of the one just finished, until filed. Report rows are created on first write, so seasons from before this sprint need no backfill. The banner under every page header snoozes for 12 hours when dismissed (`dismissedAt` is stored, so it holds across devices); the Home "Pending" card never hides. Filing saves the latest text first.
- Needs are written on a season's report for the offseason after it and show on Home until resolved, by one of the user team's transactions or draft picks from that season or the next, or by hand with a note (`resolvedAt`, `resolvedNote`), because the transaction and draft screens arrive in Sprint 7. They are not copied forward into later offseasons.
- Hall of Fame plaques cache the career with the user team (franchise and real seasons with the team, log-derived preferred) and refresh on every save; one plaque per player, coaches and staff by name from the wall. A retired number needs a number. The jersey is the `HangingJersey` primitive; `SwipeRow` and `StaffLine` are new primitives too, all in the gallery.
- History seasons edit through `history/seasons:update` (the History pencil); seasons before the nflverse import come from the `team_history` row target, which writes through the same `writeHistorySeason` and refuses franchise seasons. Super Bowl names and the finish highlights are pure (`shared/history/seasonRecord.ts`). Seasons per franchise read up to `MAX_SEASONS` (150, `convex/lib/franchise.ts`), enough for 1920 onward. A later nflverse refresh rewrites the record of an imported season (1999 on) that was edited by hand.
- The timeline reads the latest five seasons and loads older ones on request. It shows game notes and every playoff game, season notes and report text, the user team's transactions and awards, and inductions (a class inducted after the last season sits with the newest one).
- The season lifecycle is covered by `convex-test` only: Playwright shares one backend across projects, so the smoke tests never finish a season or file a report.

---

## Sprint 6 — Ingestion v2: every other screen (L)

**Goal:** no more hand entry at the end of a season.

- New targets in the registry: season player stats per position group, league leaders top 20, team season stats, standings, weekly awards, yearly awards, draft results, roster page, transactions, injury report, player card.
- Multi-image sets with merge rules (same target, same context, union of rows).
- Correction memory: corrections stored per target and injected as few-shot examples; a Settings panel shows them and lets you prune.
- Reconciliation view: season totals from a season screenshot vs totals derived from game logs, with differences highlighted and one-click acceptance of the log-derived number or a flag to find the missing game.
- Shortcut menu regenerated from the registry; context inference (current season and week by default).
- Usage and cost panel: tokens, latency and model per extraction.
- Phone: multi-image sets assembled from the camera roll in one pick, review of row-heavy targets (season stats, leaders, standings) as a scrollable list of row cards with per-row accept, reconciliation differences as a card list.

**Done when:** an end-of-season pass is a batch of photos, a review session on whichever device is in hand, and nothing else.

**As built:**

- Every new target is a **row target** (`shared/ingestion/rows`): a list screen declared as screen fields plus row fields, with one generated JSON schema, normalizer, validator, merge and review editor for all of them. Each target has a small commit function in `convex/ingestion/commit*Rows.ts`, keyed by target so a new one does not typecheck until it commits. The team season stat registry (`shared/stats/teamSeasonRegistry.ts`) keys `teamSeasonStats`.
- Targets carry a **scope**: game (box score, team game stats), week (weekly awards, injury report) or season (everything else). A set extracts once it has the context its scope needs. The capture and tag sheets drop the week for season screens, and both the Shortcut endpoint and the capture sheet infer it otherwise (the next game for a game screen, the week just played for a weekly one).
- **Multi-image merge**: a row set is read one screenshot at a time (four at once) and merged as the union of its rows by row identity, with a warning wherever two shots disagree. Box scores are still read in one call. Rows the model was unsure of start unaccepted; only accepted rows commit, and accepting is not stored as a correction.
- Committing a list moves the review on to the next set waiting, so an end-of-season pass runs set to set; a player card lands on the player and season stats on the reconciliation view. Committed names resolve to players like box score lines (new players get partial roster entries); standings also set the user team's division finish and seed on the season.
- **Reconciliation** (`/stats/reconcile`): season stats screenshots land in `reportedSeasonStats`, never in the log-derived tables. Each difference is settled by accepting the log number or flagging a missing game; the view lists weeks with a result but no box score. A re-read with a changed number reopens its difference.
- **Correction memory** and **usage and cost** are panels in Settings: corrections per target can be kept out of the prompt, deleted or cleared; usage sums tokens, cost and time per model over the last 300 extractions.
- Transactions and injuries are written as logged; their screens are Sprint 7. Without an OpenRouter key, a local deployment answers every target from `convex/ingestion/fixtureRows.ts`.

---

## Sprint 7 — League, awards, draft, transactions (M)

**Goal:** the league around the team is as rich as the team.

- Standings per season by conference and division with seeds and a playoff bracket; cumulative league table across the franchise.
- Other teams: history inside the franchise, partial rosters from observed players, draft picks.
- Awards screens: weekly grid for AFC and NFC, yearly cabinet, All-Pro and Pro Bowl lists, user-defined team awards, awards on player pages.
- Draft history, draft class retrospective grades, pick inventory, lightweight draft board linked to needs.
- Transactions log, injury report, trade tracker with retrospective notes, cap view with expiring contracts.
- Phone: standings as division cards with seed badges, bracket as a vertical round-by-round list, awards weekly grid as a week picker with conference segments, draft rounds as grouped cards, transactions as a filterable feed.

**Done when:** the League section answers "who won the AFC in 2029", awards and draft screens are populated for every played season, the cap view matches the roster, and each of these screens is complete on the phone.

**As built:**

- The bracket is rebuilt, not stored: `shared/league/standings.ts` pairs the seeds (seven since 2020 with one bye, six before with two), re-seeds the divisional round and reads each winner from where its run ended, so any season with seeded standings (imported, captured, or the user team's own record) gets a bracket and champions. League → Champions lists every season's AFC, NFC and Super Bowl winners; the all-time table can include real history. Team pages live at `/league/teams/$abbr`.
- A franchise season with no standings screen still shows the user team, from its season record and games.
- Draft grades (`shared/draft/grade.ts`) wait two completed seasons, then weigh the peak OVR on the user team's roster against the slot, playing time and honors. Real seasons before the franchise carry no OVR, so those picks are judged on playing time and honors alone.
- The pick inventory stores only picks that changed hands; every other pick in the next three drafts is assumed to be the team's own. The draft board is a new `draftBoard` table, ordered by the owner; it shows the previous season report's needs and who the team took.
- Transactions are written by the Sprint 6 screenshot targets; this sprint reads them (type chips, the trade tracker's hindsight notes, the injury report). Rosters show each player's latest injury; the player page gains awards, moves and injuries. The cap view sums contract APYs against the season's salary cap, which is set on the cap view.
- Team awards are `awards` with `scope: "team"`, given from Awards → Team.
- The planned-screen placeholder and the nav's `sprint` field went with the last planned screen.

---

## Sprint 8 — Dashboard and insights (M)

**Goal:** opening the app tells you something.

- Dashboard composed from the cards in `FEATURES.md` 5.1: season header, pending prompts, last and next game, milestones, inbox, season pulse charts, recent transactions.
- Head-to-head and rivalry views; margin-of-victory and streak charts; team rank ribbons across seasons.
- Calendar view of the season.
- Command palette with players, games, seasons, screens and actions; keyboard shortcuts sheet.
- Multiple franchises: create another franchise (team, name, first season, with its own real NFL history import) from Settings and the franchise header, and switch between them from a franchise switcher in the sidebar and the phone's More sheet. Exactly one franchise is active at a time; every screen, the inbox and the Shortcut endpoint follow the active one.
- Phone: dashboard cards in one column with prompts and inbox first, phone chart variants for pulse and rank ribbons, calendar as a vertical month list, search from the header icon, the franchise switcher and "New franchise" in the More sheet.

**Done when:** the dashboard is the screen you want to leave open on the second monitor and the first thing you check on your phone, and a second franchise can be created and switched to on either device without touching the first one's data.

**As built:**

- Home is composed from one DOM order: on desktop a main column (season header, last and next game, the pulse, milestones, the franchise record) beside a side column (inbox, the season card, team ranks, recent moves); on narrower widths the columns dissolve (`display: contents`) and `order` stacks the cards with the prompts and inbox first. `dashboard/home.season` gives the header line, last and next game with the head-to-head so far, and the week points; `dashboard/activity.recent` the user team's latest moves and injuries.
- Week points (`shared/games/insights.ts`) carry the margin and the running streak; the same rows feed the dashboard pulse and Schedule → Charts (points by week, margin of victory, streak), through `PointsChart` and `DivergingBars`, both with phone variants chosen from their own width.
- Team rank ribbons across seasons (`RankTrend`) read the captured team stats screen (`league/teamStats.trends`): Stats → Team shows every stat, Home the five pulse stats, each with its move since the season before.
- Rivals are built from captured games (`shared/games/insights.ts` `rivalries`): League → Rivals, the next-game card and team pages, which chart the margin of every meeting.
- Schedule → Calendar places each week on the Sunday the NFL plays it (`shared/games/dates.ts`: Week 1 is the Sunday after Labor Day, the Pro Bowl takes the open Sunday before the Super Bowl), with free agency and the draft after the season. Month grids when wide, a vertical list of game days per month on the phone.
- The palette searches players by name on the server and every franchise game by year, week or opponent once something is typed, and switches franchises. `⌘K`, `/` and the header search icon open it; the shortcut sheet lists what is registered, `[` `]` on game detail included.
- Several franchises: creating one deactivates the current one (`franchise/create.ts`), and `franchise/franchises.activate` switches. Every query already read the active franchise, so screens, the inbox and the Shortcut follow; Shortcut tokens are listed account-wide. A switch goes Home and forgets the seasons remembered for the old franchise. The switcher is the sidebar's franchise header, the More sheet on the phone, Settings → Franchises and the palette; "New franchise" opens the setup form at `/franchises/new`.
- The sample adds a scheduled rematch, team ranks for two seasons and an inactive second franchise, so the dashboard and the switcher have data in tests. Playwright never switches (all projects share one backend); `convex/franchise/switch.test.ts` covers switching.
- `Segmented` scrolls within its own width when its options do not fit, so five views fit a 390 px phone.

---

## Sprint 9 — Polish, resilience, packaging (M)

**Goal:** finished product.

- Visual pass on every screen at desktop, tablet and phone widths: spacing, empty and loading states, light theme, reduced motion, safe areas, touch target audit.
- Performance: virtualized tables, indexed queries audited, aggregate recompute timed, phone scroll performance checked on long tables.
- Export JSON and CSV, full backup and restore, scheduled Convex backup.
- Offline read cache and queued captures hardened; optional Tauri wrapper for a dock app with a native title bar.
- Test coverage on stat math, registry integrity, extraction validators, import diff, and the commit and recompute path with `convex-test`.
- Authorization audit (single user, token endpoint), error reporting, rate limit on the HTTP endpoint.

**Done when:** a fresh clone, `npm install`, `npx convex dev` and franchise setup reproduce a working app, the launch readiness checklist passes, and a full walkthrough of every screen on the phone finds nothing the desktop can do that the phone cannot.

**As built:**

- The launch readiness checklist is `docs/LAUNCH.md`. `npm run check:fresh-clone` automates the fresh clone check (clone, install, new local backend, first-run setup in Chromium). It found that first-run setup had been broken since Sprint 8 (the shared franchise form never called `create` without an `onCreated`), which every other test missed because they all run against the seeded sample. Fixed.
- Authorization audit: `audit/convex.test.ts` reads every Convex function and fails the build when a public query or mutation skips `requireOwner`, an action skips the new `requireOwnerAction` (actions used to check only that someone was signed in), the HTTP endpoint skips its guard, a function lacks validators, or a query uses `.filter` or `.collect()`. It found no gaps in queries or mutations.
- The Shortcut endpoint is rate limited with `@convex-dev/rate-limiter`: valid tokens draw from a bucket (20 at once, then one every 2 s); bad tokens are throttled on their own bucket so junk requests never lock out the owner.
- Error reporting: uncaught errors, unhandled rejections and route errors go to `errorReports` (one row per fingerprint, capped at 100), shown in Settings → Errors. Nothing third-party.
- Backups: every franchise, nightly (`convex/crons.ts`, fourteen kept) and on demand, as gzipped JSON in file storage, written and compressed a page at a time with `fflate`. The default runtime has no compression streams, and Node actions would need a Node version local backends may not have, so nothing uses `"use node"`. Restore runs in the browser and writes batches through owner-only mutations as new, inactive franchises, ids rewritten through a map; the transactions ↔ pick inventory cycle is patched at the end. An inactive franchise can now be deleted (typed name), its rows swept in the background, so a restore or an old franchise can be cleared away. CSV exports the active franchise's games and player seasons.
- Offline: every query result a screen showed is kept in memory and IndexedDB (`useQuery` from `@/lib/convex/useQuery`, required by ESLint) and served only while offline, keyed per franchise; the auth gate lets a device with a cached session through when it cannot check the session; signing out clears it. The capture queue shares one flush between triggers, skips and finally drops captures the server refuses (reporting why), and retries when the app returns to the foreground.
- `DataTable` renders only the rows in view past 120 rows (each row and its phone card in its own `tbody`, measured by `@tanstack/react-virtual`). Phone scroll performance was checked in WebKit at phone size, not on a device.
- Recompute timing: the after-game refresh for a 13-player box score finishes inside the CLI's resolution (well under 20 ms) on the local backend with the sample; full-history franchises were not timed.
- Touch targets: an audit of every screen at 390 px found view switchers and chips at 36 to 40 px, sort buttons at 17 px and small links; a `touch-target` utility gives small controls a 44 px hit area, primitives grew on coarse pointers, and `e2e/touch.spec.ts` keeps it that way with a reduced-motion check. Every screen was also swept for overflow at tablet width in both themes.
- Test coverage of `shared/` is 96.7% of lines and 84.8% of branches (`npm run test:coverage`), up from 93% and 79%: the row-target normalizers and validators, registries, stat groups and the season summary gained tests.
- The optional Tauri wrapper was not built; the installed PWA covers the Mac and the phone.

---

## Sprint 10 — Everything editable, moves, goals (L)

**Goal:** nothing the app shows is out of the owner's reach: every move of the league year is recorded, every number can be corrected in place, and anything a screenshot does can be typed.

- Trades (two teams, players and picks by round, a note), free agent signings and every other move, with when they happened; rosters and pick ownership follow.
- Inline editing behind an Edit button on every table: roster, player history, box scores, team stats, game logs; edit every player fact; move players by hand; create players and games.
- A manual counterpart for every screenshot target; a league schedule / scores target.
- Stats: big-game counts that always show per position group, 158.3s, and a season high per stat linked to its game.
- Roster: offense, defense and special teams tables, a color per position family, averages per side.
- Game stars picked by hand; schedule cards with every star and the full notes; a game's import sheet can use inbox screenshots.
- Pre-season goals, tracked on Home and Stats. Delete any franchise with two confirmations. Real NFL history from 1999.

**Done when:** a whole offseason (re-signings, free agency, the draft, trades) and a season can be kept with or without screenshots, and any wrong number can be fixed where it is shown, on either device.

**As built:**

- `DataTable` has an edit mode: a column with `edit` (number, text or select) becomes an input after Edit and saves per cell through the screen's `onEdit`, in the table and the phone's expansion cards. Roster, roster history, box score and game log use it.
- Moves are recorded from Transactions (`convex/transactions/moves.ts`). The roster and pick changes a move implies are planned in `shared/transactions/` and stored on the transaction field by field, so editing or deleting a move undoes only values it still owns and leaves later manual edits alone. Trades are stored from the user team's side; the old team's roster entry becomes "Traded away" as of the week. Phases (`TRANSACTION_PHASES`) order the feed before weeks.
- A manual Move (roster row or player page) changes team or status without a transaction; Add player creates a player with a roster entry.
- Season rows materialize `bestGames` (value, game and week per stat); rates count only with volume (`SINGLE_GAME_MINIMUMS`). The count columns per group are declared in `shared/stats/groups.ts`. After deploying, `npx convex run stats/rebuild:all` rebuilds existing season rows.
- Stars are never extracted; `games/stars` picks them. Each star's stat line is built from the game's box score whenever stars are read (`loadStarPlayers`, `shared/games/starLine.ts`), never stored; the caption is a note. `games/clearTypedStarLines:run` (dry run first) clears captions typed as stat lines before that, wherever the box score now has the line. Games are created, edited and deleted in `games/manage`; stat lines in `games/statLines`. Every edit runs the same refresh as a committed box score.
- Manual entries live in `manualDrafts` (not backed up, never corrections) and commit through `convex/ingestion/commitDraft.ts`, shared with review. Empty drafts come from the targets registry.
- `league_schedule` reads Madden's week schedule into `leagueGames`; League → Scores shows it.
- Goals (`seasonGoals`, `shared/seasons/goals.ts`) are hit, missed, in progress or pending; missed only once settled; a manual outcome wins.
- Deleting the active franchise activates the one used before it (`franchises.lastActiveAt`) and clears its offline cache.
- 1999–2001 standings are derived from nflverse schedules with seeds read from the playoff games, shown in that era's six divisions (`shared/league/alignment.ts`). Existing franchises add them from Settings or `npx convex run history/importJob:importEarlierYears`. Options before 1999 are in `docs/NFL-HISTORY.md`.
- Built by parallel builders on disjoint areas over a shared foundation commit, then merged.

---

## Sprint 11 — One league page, three records books (M)

**Goal:** a season's standings, scores and bracket read as one page, standings and playoffs follow from the scores, and records reach back before the franchise and across the league.

- League: standings (divisions or conference), scores and playoffs on one page; projected seeds, bye and wild card tints, z/y/x clinch marks; the bracket always filled, projected until week 18 is over. No point differential and no user-team highlight in the standings.
- Division ranks, seeds and playoff results worked out from league scores. A season's league schedule loaded from nflverse, or several weeks of schedule screens in one set.
- Records: team (real seasons included), franchise-era and all-time books, top 20 per list with player, number, team and year; typed numbers; every list a player makes on his page; streaks kept at their longest.
- Shared `Textarea` and `Field` for the hand-built note fields and sheets; the dashboard's activity uses the league-year labels ("Free agency", "Week 7").

**Done when:** a season with an imported schedule shows projected standings, clinches and a projected bracket from week 1, locks when week 18 is in, and the records books answer "who has the most career sacks" for the team and the league, on either device.

**As built:**

- `shared/league/tiebreakers.ts` picks teams one at a time like the NFL; `projection.ts` seeds the field, marks clinches (a team has clinched against everyone who cannot reach its record winning out while it loses out; ties count against it) and builds the board. `league/board:season` serves the page; every team of the league is listed from kickoff.
- `refreshLeagueRecords` settles worked-out rows once the field is set and clears them while it is not; captured and imported rows keep their printed ranks. The user team's game record wins over a standings screen read before it.
- `leagueGames/importSchedule:fromNflverse` loads matchups and kickoff times only, and skips weeks that already have games. Schedule rows carry an optional `week`, so one set may span weeks.
- Records boards are rebuilt by `stats/recordBuild` (after the history import, from the Records screen, or `npx convex run stats/recordBuild:start`); until a franchise has built its books, games skip the board updates. Existing franchises press Build the books once. Boards and placements are not backed up; build again after a restore.

---

## Sprint 12 — League stats, fantasy points, more awards (M)

**Goal:** the season awards can be argued from the numbers: the whole league's stats sit next to ours, every table scores fantasy points, and the awards Madden does not give are counted.

- Fantasy points (ESPN default PPR) as a column in every stat table.
- Stats → League: everyone's season totals by position group, ours from the logs and the rest from captured season stats screens; and every team's season from Madden's league team stats screen (offense, defense, conversions, red zone, turnovers), captured or typed in.
- Awards: Madden's best-at-each-position awards; Fantasy Player of the Year, Sack Leader, Ball Hawk, Heat Seeker and the most players of the week counted from the stats; any season award assigned or overridden by hand.

**Done when:** a season stats screen of another team lands in League stats, the counted awards name its leaders, and an award assigned by hand replaces the count on phone and desktop.

**As built:**

- `fantasy` is a stat category with two derived stats, `fantasyPts` and `fantasyPpg`, that list no inputs, so they are a column wherever a table has rows. Box score categories are `RAW_STAT_CATEGORIES`; extraction schemas and line editors read those. Season rows pick up a fantasy season high after `npx convex run stats/rebuild:all`.
- `convex/lib/leagueStats.ts` merges the user team's logs with `reportedSeasonStats` for every team; `stats/league:bySeason` serves the League view and `awards/counted:bySeason` the counted awards (`shared/awards/counted.ts`). Counted awards are not stored: an assigned winner (`awards/assign`) is an ordinary award row that wins over the count.
- The yearly awards import offers the new best-at-position awards; counted awards are never extracted.
- `league_team_stats` reads any of the five tabs into one array per tab (headings repeat across tabs with different meanings, so the tab decides the field) and merges each team's tabs into its `leagueTeamStats` row. Only counts are read; rates, margins, differentials and per-game figures come from `shared/stats/leagueTeamRegistry.ts` (tab layout in `leagueTeamTabs.ts`), so rates show one decimal where Madden rounds down.

---

## Sprint 13 — Coach of the Year, awards layout, weekly awards in bulk (S)

**Goal:** the awards page reads at a glance, Coach of the Year names a coach, and a season's weekly awards go in at once.

- A bank of every NFL head coach since 2015 plus coaches created in the franchise; Coach of the Year picks from them.
- Awards: league awards (MVP, Coach of the Year, Super Bowl MVP) apart from an AFC and an NFC column; empty awards and uncaptured weeks tucked away.
- Weekly awards batch: upload every week's screen together, match each to its week, read and commit together.
- Any player a committed screen names who is not in the database is added, team or no team.
- Released and traded-away players leave the roster page; reconciliation settles or reopens every picked difference at once; season and league stats tables show player photos.

**Done when:** a season's 18 weekly awards screens go from upload to committed on one page, Coach of the Year can go to a bank or a created coach, and the awards page shows only what has been won, on phone and desktop.

**As built:**

- `awards/coaches` lists, creates and deletes created coaches (`coaches` table, unique per `coachKey` spelling); `awards/assign:assignCoach` stores Coach of the Year as a name and team, creating an unknown coach. The yearly awards import does the same for a COY row and never makes the coach a player.
- Conference awards (`CONFERENCE_AWARDS` in `shared/awards/groups.ts`) are assigned and cleared per conference; a winner stored without a conference counts in their team's.
- `ingestion/weeklyAwards` serves the batch page (`/inbox/weekly-awards`): `create` makes one set per screenshot, `setWeek` matches a set to its week until it is committed, `readAll` reads every matched set, `commitReady` commits the sets that need no review through the same `commitSet` review uses.
- `rowPlayer` creates a new player for rows without a team (awards, leaders), with no roster entry.
- Season stats rows take their team from the row, else the screen's Team shown; they no longer default to the user's team, which had put other teams' players on the user's roster. Each ingestion target declares `goesTo`, shown under the screen picker.
- `stats/reconcile:resolve` takes a list of differences, writing each player's screen row once. `stats/season:bySplit` and `stats/league:bySeason` return each player's headshot URL.

---

## Sprint 14 — Scoring plays (M)

**Goal:** a game's scoring summary becomes a play list, so the app knows when things happened: quarter scores fill themselves, the game-winner has a name, and a missing name takes one tap to fix.

- `scoring_plays`, the first row target tied to a game, read over several screens and merged by quarter, clock and team.
- `scoringPlays` table, committed as a set per game; `lineScore` derived from it.
- Checks against the game: each play worth what its kind says, the running score, the final, the box score's touchdowns.
- A row with no name assigned from the box score, in review or on the game page, without ever blocking a commit.
- Scoring summary and `ScoreWorm` on game detail, period and clock marks in the player game log, scoring entries in records, milestones and team records.

**Done when:** a game's scoring summary goes from photos to a play list in review, a row with a missing name is assigned in one tap to the only receiver with a touchdown, the quarter scores fill themselves, and the game page says who had the game-winning score.

**As built:**

- `shared/ingestion/rows/scoringSpec.ts` is the target; `RowSpec.optionalPlayer` lets a row stand with no player and `RowSpec.order` keeps rows in game order. `RowSpec.rules` now also receives the game (`RowGameContext`, null when there is none, undefined until known), and `validateDraft` passes it on. Review reads it live (`games/scoring:reviewContext`) rather than from the draft, so a game log committed while the summary waits for review counts; commit reads it again and enforces the same errors.
- Wrong points, a score that does not add up and a last play that misses the final are errors. A box score disagreement is a warning; a missing name is a warning that never blocks.
- A scoring row never creates a player: a printed name that matches nobody stays as `rawName`, since "K. Boutte" alone is too thin to know a new person by. The review picker has no new-player option here.
- `ingestion/commitScoringPlays` rewrites the game's plays as a set, keeps a player assigned on the game page through a re-read of the same play, and fills in a final the game does not have yet. A week with no game refuses the commit.
- `passer` is stored flat (`passerId`, `passerName`) rather than as the nested ref `STATS-HUB.md` 4.10 sketched, so a player merge finds a player's passes by index. The index is `by_playerId_and_seasonId`, which the player game log reads, in place of `by_playerId`.
- Quarters worked out from plays cannot be typed over: `games/schedule:setLineScore` refuses and the editor is hidden, with "From the scoring plays" under the table. Editing the game's final stops the quarters standing, and typing works again.
- `scoringBoards` holds the scoring records (`shared/stats/scoringBoards.ts`): the longest score of each kind, most touchdowns in a quarter, game-winners and connections by season and career, and for the team the best quarter, the largest comeback and the largest lead lost. They show under the books on Stats → Records. The team lists live here until Sprint 15's `teamRecords`. Boards are rebuilt from the plays, so they are not backed up; plays are.
- Milestones `first_td`, `game_winner` and `connection` (10, 25, 50, 75 and 100 touchdowns) come from `stats/scoring:afterPlays`, which rebuilds on every change, so a game-winner that changes hands moves its milestone.
- The game page asks for a player on a nameless play, or on the user's own unmatched scorer. An opponent's printed name stands, since that box score is often not captured.
- The stars editor lists the game-winner first.
- The full game log carries the scoring summary too (`GameLogDraft.plays`, optional so drafts stored before it still commit), so a game's screens go up as one upload. The plays are checked by the same rules, against the log's own final and box score (`shared/ingestion/rows/gameLogPlays.ts`), and commit after the box score so a printed name reaches a player it just added. A wrong play blocks the commit until it is fixed or left out; leaving every play out commits the rest.
- Left for the sprints that show them: `playerScoring`, `kicking` and `teamScoring` in `shared/stats/scoring.ts`, `stats/scoring:player` and `stats/scoring:team`, and the Trends and Overview uses in `STATS-HUB.md` 4.10. Nothing reads them yet.

---

## Sprint 15 — Stats engines and storage (M)

**Goal:** the numbers the stats hub needs exist and stay current, so every later view is one read: running totals, marks, best spans, pace, year over year, splits, quarter scoring, team records and streaks with dates.

- `ledger`, `marks`, `spans`, `pace`, `yoy`, `splits`, `quarters` and `teamRecords` in `shared/stats`, plus extended `streaks`, all unit tested.
- Storage for marks, spans and team records, kept current after every game.
- `recordBuild` extended, `stats/rebuild:all` growing with it, and a Settings button so nothing is CLI-only.
- `players/gameLog:career`, and backup coverage.

**Done when:** a committed game sets a mark, improves a span, dates a streak and sets a team record, recommitting changes nothing, and a rebuild from scratch matches the incremental result.

**As built:**

- Marks and spans do not add scopes to the records tables, as `STATS-HUB.md` 5 sketched: their entries have a different shape, and every book screen would have had to learn about them. `playerMarks` holds every mark reached; its index ends in `gamesToReach`, so a fastest-to list is one ordered read with no board. `spanBoards` holds each stat and window's top entries, a player's best and his next best that does not overlap it. When Sprint 17 lists them it reads these directly; typed entries and placements for them are that sprint's to add.
- Marks and spans count the user team's games only, regular season for marks and each split apart for spans: other teams' lines come from box scores against us, so a count over them would be wrong. Imported seasons are a starting total and a game count, and a mark they already passed has no game to name, so it is left out.
- `MARKS` keys also give the span stats (`SPAN_STATS`), rather than every summed record stat, so a game reads 156 boards at most, not several times that.
- `stats/performance:afterGame` runs after `refreshAfterGame`, eight players a step, then the team. The plan ran it inside `afterGame`; a career's folds across 13 stats and 6 windows do not fit there comfortably.
- `teamRecords` lists are rewritten a season at a time (`stats/teamRecords:writeTeamRecords`). The three team lists that lived in `scoringBoards` moved here (`pointsInQuarter`, `comeback`, `blownLead`) and still show on Stats → Records. `stats/scoring` drops the old rows when it next writes, and never shows them. Team stats that were not captured leave a game off a list rather than counting as zero.
- Streak rows keep `currentFrom`, `longestFrom` and `longestTo`. Eight player kinds, five team kinds and four season-long kinds are new. Season-long runs count seasons with status `complete`; a division title reads the standings row's division rank, so it needs the standings captured. The per-season streak rows in the plan are left for Sprint 17's season filter, which can work them out from the games.
- New milestone kinds `mark`, `player_streak` (5, 10, 15, 20) and `team_record`. A team record needs an earlier entry to beat, so the first game on a list raises nothing, and season lists raise nothing because a running total would fire every week.
- `recordBuild` gains the phases `logs` (every season row, which replaces the `stats/rebuild:franchise` chain), `performance` and `teams`. Settings → Data → Rebuild stats starts it from `logs` and shows while it runs. **After deploying, run it once:** marks and spans fill in per player as they next play, but earlier seasons reach `teamRecords` only through a rebuild, and until then the team lists on Stats → Records are empty.
- `playerMarks`, `spanBoards` and `teamRecords` are not backed up, being rebuilt from the logs; run Rebuild stats after a restore.
- `players/gameLog:career` reads every season, with `filter: { statKey, min }` applied on the server. `shared/stats/math.ts:pace` moved to `pace.ts` as `seasonPace`.
- `pace`, `yoy`, `splits`, `quarterScoring` and `runningTotals` have no screen yet: Sprints 16 to 18 show them.
- Left for Sprint 17 as planned: `bestGames` keeping three games per stat, and the list queries for marks and spans.

---

## Sprint 16 — Identity for the created era (M)

**Goal:** the app knows who everyone is for the second decade of a franchise, when nearly every player is a Madden-created one: where each player came from, whether they are real, what they are called, and which player a printed name means.

- Provenance on the player, with `isReal` worked out from it, and a Settings job for players from before it was kept.
- Names split properly everywhere a player is created; the printed form kept as an alias; aliases searchable; a fuller source upgrades a one-initial name.
- Resolution that starts from the scheduled game, ranks active players first, leaves retired players out of the search, carries a choice forward a season, and offers the team's known players in the picker.
- Draft classes matched to the slot's pick and to players created that season; a recommit never duplicates.
- Commit guards: no game creates a player nobody decided on, and the weekly batch never commits a new player unseen.
- Identity tools over every captured player, every screen's corrections, a "seen in" list, and duplicate suggestions on the player page.

**Done when:** a box score in a later season can only create a player after someone says so, that player is fictional and dated, the face match no longer lists them, a draft class committed twice leaves one player per pick, a name printed "M.Hawkins" is searchable and becomes Marcellous Hawkins when a fuller screen commits, and every older player can be tidied from Settings.

**As built:**

- `origin` is `import`, `draft`, `screenshot` or `manual`; `roster_import` and `restore` from `PLATFORM-AUDIT.md` 2.2 A are left out. Rosters import against players the import already made, and a backup keeps each row's origin, so neither would ever be written. The sample's bundled players count as `import`.
- `isReal` stays a stored field, set when a player is created (`shared/players/provenance.ts:derivedIsReal`) and on an ESPN match, so every reader stays one field and the owner's override stands. A draft class filed under the franchise's first season counts as real, as it holds the real rookies. Manual entry passes `manual` through `commitDraft`; moves and the game page's added lines are `manual` too, and `players/create` keeps its explicit real or fictional choice.
- `aliasesText` feeds a second search index, `search_aliases`, instead of one combined field: the 16,000 imported players then need no rewrite to stay searchable. `aliasFields` writes both, `players/nameSearch.ts:searchPlayers` reads both, and `retired` is a filter field on each.
- A name upgrade happens where a row has already settled on a player, in `playerFor`, so the resolver's choice or the owner's pick is the "same team" test. `nameScore` now scores a full name against a stored initial, which is what lets the resolver reach such a player. Position must still agree by group.
- The resolver's teams are `jobs:load`'s `gameTeams` (the user's team and the scheduled opponent, from the game or `leagueGames`) plus whatever the model read. Retired players are left out of the text search only: someone on a season's roster did play that season. `resolvePlayers` moved out of `extract.ts`.
- A carried choice comes from the season before only, and is dropped if the player has retired or this season's rosters show them gone. It scores 0.95, so it matches without counting as this season's own choice.
- The picker's team panel is `players/search:teamRoster`, keyed by the line's team and position (`pickerContext`). It is hidden for draft picks and scoring plays.
- Draft matching is `shared/ingestion/draftMatch.ts`. A row's slot wins if the name fits; otherwise the pool is `by_createdSeasonId`, where a name alone is never enough. `commitDraftResults` applies the slot rule again at commit, for two reads of one class reviewed side by side. The "Draft class" checklist step is Sprint 18's, with the checklist.
- `DraftLine.confirmedNew` and `DraftRow.confirmedNew` hold the decision. Undecided game lines are validation errors, so `commitDraft` refuses them with the rest; a line with no stats is skipped at commit and needs none. Accepted rows with an ambiguous name are held the same way, which goes past the audit's game targets: the row was creating a player nobody chose. Rows that are simply new still commit, since review shows them, except in the weekly batch. Scoring plays never create a player, so theirs stay a warning.
- The weekly awards fixture now names a sample player, so a clean batch stays ready.
- `players/tidy` is the backfill, offered in Settings → Player identity while anyone has no origin. It walks `by_franchiseId_and_origin`, only ever turns a player fictional (one already fictional was the owner's doing), and repairs a name only if it still carries the old naive split, so a hand edit stands. **After deploying, run it once.** A restored backup from before this sprint offers it again.
- `identity:duplicates` is paginated, newest first, and Settings checks 60 players at a time with a button for older ones: a full scan on every Settings visit would read tens of thousands of documents. `duplicatesOf` serves the player page; `seenIn` serves the player page, the Settings pair and the merge dialog through `components/player/SeenIn`.
- A merge now keeps the earlier `createdSeasonId` and the source's `espnLeague`, makes the person real if either half was matched, and keeps a headshot only the source had.
- Left for later: the "Week 9 vs MIA: 53 known players" line on the capture sheet (`PLATFORM-AUDIT.md` section 3) and the "how we got here" story on the player page; `seenIn` covers the facts behind them. 2.2 E and F remain Sprint 18's.

---

## Sprint 17 — Stats hub: overview, pace, trends (M)

**Goal:** the numbers Sprint 15 made start to show. Home and Stats say what a season is on pace for, the roster's nearest marks are counted down, and a career reads as curves rather than rows.

- Stats opens on an Overview of the season; a Trends view charts the team or any player across seasons.
- The Season view can show each player's pace, or the change from last year.
- Home gains the pace line and a Countdowns card.
- The player page gains Pace, Trends and Cumulative.
- `CumulativeChart`, `SeasonBars`, `PaceBar` and `DeltaBadge` in the gallery.

**Done when:** Home and Stats say what a season is on pace for, and the player page shows a career as curves, not only rows.

**As built:**

- `shared/stats/hub.ts` holds pace, leaders, countdowns and `paceGoals`; `shared/stats/trends.ts` holds the curves. `seasonInProgress` is the one test for when a pace means anything: status `regular`, with games played and games left.
- A player's pace counts the team's games left, not the player's rate times 17, so a player who sat out three is not projected to play them (`playerPace`, `projectedLine`). `paceGoals` passes the same finish to `paceTargets`.
- Countdowns rank in games away at each player's career rate, not in yards: 90 yards is two games for a starter and a season for a fullback. Only marks within a season at that rate show, one per player, or a running back's rushing and scrimmage yards would fill the list.
- `stats/hub:overview` and `stats/hub:countdownsFor` are the Overview and Home reads; the Overview also reads `stats/streaks:all` and `league/teamStats:trends` rather than a second copy of them. "Set this season" is the season's `franchise_record`, `team_record` and `mark` milestones.
- `stats/trends:player` and `stats/trends:team` are one read each. A player's games are those with the user's team, as marks and spans count them: another team's lines come from box scores against us.
- The Season view's display is `Totals`, `On pace` or `Vs last year`. Pace rewrites the rows, so every column, the highlights and the totals row follow without knowing about it. Neither view edits, since neither is a stored number. A change shows only on stats that add up, because rates do not subtract.
- `CareerCurves` is one component in `components/player`, so the player page and Trends share it without a feature importing a feature. It takes its data as a prop and owns the stat picker, so Trends and Cumulative stay on one stat.
- `TrendChart` gains `scale="auto"` and `format`; OVR keeps its rating axis by default.
- A record's pace is hidden when the season being played holds the record: racing yourself says nothing.
- Stats now opens on Overview, and the "real NFL history" notice moved up to `StatsScreen` so a season opened from History shows it on either view. A stored view choice is kept.
- The Home games row was a grid with an implicit column, so a long opponent name stretched the phone layout. It now has `grid-cols-1`. That bug predates this sprint; sample data only hit it on some weeks.
- Left for later: `splits` and `quarterScoring` still have no screen (Sprint 21), and team record lists and streak dates wait for Sprint 19. Overview's tiles open the view with their detail; a per-tile deep link can wait for the views that need one.

---

## Sprint 18 — Roster truth and the season checklist (M)

**Goal:** the app, not the owner, keeps track of who is on each team and what to capture next: a roster page is the truth for its team, carry-over ages contracts and drops people nobody has seen, old players get a retirements step, and Home says what is done and what to shoot.

- A committed roster page releases who it leaves off, with an undo list, and writes the depth chart from its order.
- Carry-over decrements contracts, holds expired user-team deals for a decision, and keeps other teams' players only while something names them. The 150-entry caps become one constant, tested past it.
- A yearly retirements step, ingested retire rows that apply the flag, and Hall of Fame candidates.
- Roster gains a team switcher, a depth chart view and a roster diff.
- Home gains the season checklist and the coverage strip.

**Done when:** a whole roster page releases who is missing and can be undone, a season's carry-over leaves a player with an expired deal waiting and a ghost behind, the retirements list closes with a logged move, any team's roster opens with its depth chart and changes, and the checklist says what to shoot next from the data alone.

**As built:**

- `lastSeenYear` is a number, not the `lastSeenSeasonId` in `PLATFORM-AUDIT.md` 2.2 E, so carry-over and the retirements test need no season reads. `playerFor` stamps it, which covers every commit that names a player; manual moves stamp it in `resolvePeople`, the game page's added lines in `statLines`, and a new player's `provenanceOf` sets it.
- There is no backfill. A player with no `lastSeenYear` is carried and stamped with the season carried from, so imported rosters and anyone from before this sprint get two more seasons and then prune. `stillSeen` keeps a player seen in the season carried from or the one before.
- Pruning drops the roster entry, never the player: the next commit that names them finds them by search and makes a new entry. The user team is never pruned, and nothing here touches `isReal` or the imported stats.
- `unsigned` is a new roster status, shown as Contract expired. The entry keeps its old terms with `years: 0`, so the prompt can show what they were paid, and `underContract` keeps it off the cap. A re-signing or any other `ensure` with no status of its own settles it (`rosterEffects.applyOp`), and deleting that move brings the prompt back. A player nobody decided on stays unsigned through later carry-overs. The cap view's filter also stops counting traded-away entries, which it did by mistake.
- `agedContract` pins `apy` before `years` shrinks, since `capHit` falls back to `total / years`. A contract with neither `years` nor `expiresYear` has nothing to age, and stays. `expiresYear` decides over `years` when both are there.
- "Whole page" is the rule that stops a filtered screen from releasing the team: at least `MIN_WHOLE_ROSTER` (40) accepted rows and no `meta.partial`. `partial` is a meta field the model can set from a filtered screen and review can flip. The practice squad is never released, because Madden lists it apart.
- A page also brings back anyone it lists who was released or traded away, and marks anyone it lists as traded from another team that season. Both go through the same `changes` list. The audit asked only for the releases; a ghost entry on the old team was the same bug from the other side.
- `rosterSyncs` is the undo list and doubles as "a roster page was committed" for the checklist and the partial label. It is not backed up, so after a restore a team reads as partial until its next page, and the checklist's Roster page item reopens. `settle` restores only entries still holding what the page wrote, and clears the list either way. Commit lands on `/roster` with the team, where the notice is, since a list otherwise moves straight on to the next set.
- `MAX_ROSTER` is 300, one constant in `lib/franchise.ts` used by the twelve files that had their own 150. The test carries 220.
- A retirement now also releases the entry, in `planRoster`, so a retired player leaves the roster page and deleting the move undoes both. This applies to moves recorded by hand too. "Released" is the closest status there is; the Retired move on the player's page says why.
- Ingested transactions run `planRoster` and `applyRoster` for every type, not only `retire`, and store `effects`, so a captured release, signing or trade moves the roster and deleting it undoes that. The audit's finding 4 named this; 2.2 F only asked for retire.
- Suggestions read one new index, `rosterEntries.by_seasonId_and_age`, from 34 up, rather than 32 teams' rosters. Carry-over fills `age` from the player when the entry has none, so the index sees imported veterans. Entries with no age and no birth year are never suggested. The list shows only while the season is `upcoming`; `seasons.retirementsReviewed` closes it. That flag is the one fact on the checklist that is a decision rather than data, since keeping everyone writes nothing else.
- Depth order is `byDepth`: slots first, then OVR. `byDepthOrder` on the Roster tables uses it, so a set chart also orders the tables. `depthSlots` numbers a page's rows per position, not per position group, matching how Madden charts them. Arrows call `players/depth:reorder`. A page sorted by another column writes that order; the arrows are the fix.
- `RosterTables` came out of `RosterScreen` to make room. The diff reads earlier to later whichever season is picked, so an arrival is always someone who joined. The batch bar stays on other teams' rosters; each pick keeps its own team.
- Standings have no week, so "Standings" compares the user team's `w + l + t` in the captured standings with regular-season games played: no new field, and a screen shot mid-season stops where it was shot. Final standings need 17.
- Season stats on the checklist read the categories in `reportedSeasonStats`, which is the user team's. Free agency is `optional`: a year with no signings is a real year, so it never holds the offseason open. `seasons/checklist:forSeason` is a dozen bounded reads plus three per played game, and `seasons/coverage:forSeason` serves Reconcile. Both return null for imported seasons.
- Hall of Fame candidates are a list under the wall, not on the induction sheet, which is only reached from a player page. They read the team book's career lists.
- Playwright smoke tests for the depth chart, changes, team switcher and checklist are written; this sprint left them to CI on purpose (the Mac's swap was full), so the phone project has not run them. The screens were checked by hand at 390 x 844 in light and at desktop width in dark.
- Left for later: `depthSlot` for other teams beyond what a page writes; contract years in the cap projection (Sprint 22); the "Week 9 vs MIA: 53 known players" line on the capture sheet still waits. The audit's "how we got him" story stays open too.

---

## Sprint 19 — Records and streaks depth (M)

**Goal:** the numbers Sprint 15 stored can be looked up. "Fastest to 1,000 yards in a season", "most TDs in any 5 games" and "most points we ever scored" are each one tap from Records, streaks say when they ran, a player's page tells his milestones in order, and Madden's league leaders say where the team ranks.

- Records gains Fastest to, Best spans and Team records beside the books, and single-game lists stop at no player's best game.
- Streaks shows what is running now and the longest of every kind, with dates, of all time or within a season.
- The player page gains a milestone timeline and best-span placements.
- League gains Top 20s with "where we rank".
- `RankedList` and `MilestoneTimeline` in the gallery.

**Done when:** each of those three questions is one tap from Records, a streak names its start and end, a player's page lists his marks with the games they took, and a captured leaders screen marks our players and sums up where we rank.

**As built:**

- `topGames` is a new field beside `bestGames`, not a change to its shape as `STATS-HUB.md` 5 sketched, so no row needs rewriting to stay valid and the season table's readers are untouched. It keeps three games per record stat; `gameEntries` falls back to the plain best on a row without it. List entries and placements gain `gameId` and `weekKey`, and every book's single-game entries link to their game.
- `mergeEntries` now replaces everything stored for a player's season at once, so a game that fell out of a season's top three leaves the list. A typed entry still replaces all of that player's entries for the season.
- **After deploying, run Rebuild stats once** (Settings → Maintenance since Sprint 20). Until then single-game lists show one game per player-season and name no game. The `logs` phase now also refreshes the franchise-era book, which until now moved only when a game committed. `recordBuild:start` skips `logs` and so does not fill `topGames`.
- Fastest-to and span lists show a stat at a time, one list per mark or window, rather than a mark or window picker: it is fewer controls and shows more. They count franchise games with the team, so they take no typed entries, a change from the plan: a typed "in 41 games" is a number the app cannot check, and the franchise-era book takes none either.
- Marks are regular season only, so the split control hides on Fastest to. Which of the four Records lists is showing lives on `StatsScreen` for that reason.
- There is no rank table for spans or marks. `stats/spans:forPlayer` reads the franchise's span boards (156 small rows at most) and `stats/milestones:forPlayer` reads the top 20 of each mark he holds, both only when his page opens, so a rebuild has no placements to rewrite.
- The team lists left the Scoring plays section for Team records, so each shows once. `ScoringRecords` is scoring plays only again.
- `stats/streaks:all` is gone. It took 500 rows off an index in player order, which a long franchise would outgrow at random, and ex-players kept their old `current`. `running` starts from the current roster (one read per rostered player) and `longest` reads each kind's top 10 off the new `streaks.by_franchiseId_and_key_and_longest`. A run still counts as running while a player is on IR or the practice squad; a released or traded player's does not. Level runs sort in registry order, so a starter's games played comes last.
- The season filter works runs out from that season's games and lines on read, as Sprint 15 planned. It covers team game streaks and player streaks, not the four season-long kinds.
- `playerTimeline` takes marks from `playerMarks`, not the feed's `mark` rows, which only say what was announced at the time. One line per mark per game, career first. It holds every milestone kind, threshold games included, behind Show all.
- `RankedList` is the third strike of the records list: `RecordList`, `ScoringRecords` and `LeadersBoard` now use it, as do the new lists. `milestoneIcons` moved down to `components/data`, and `MILESTONE_KINDS` to `shared/domain`, so the feed and the timeline share them.
- A streak milestone's title keeps its capitals ("games with a TD pass"); rows already stored keep the old title.
- `leagueLeaders` was stored and fed the all-time book, but had no screen. Top 20s sits in League rather than the Leaders view, which is the franchise era's career leaders. "Ours" is the row's team, so a leader captured with no team reads as someone else's.
- The game log and box score badge for a game that reached a mark (`STATS-HUB.md` 4.2) and the missing-games count next to these lists (`STATS-HUB.md` 2.6) were left here and done in Sprint 20. Sprint 21 still takes `splits`, `quarterScoring` and the Explorer.
- Playwright smoke tests for all of this are written and left to CI, because the Mac's swap was full again; the phone project has not run them. The screens were checked by hand at 375 x 812 in light and at desktop width, and the new primitives in dark in the gallery.

---

## Sprint 20 — Operations without a terminal (S)

**Goal:** the owner never needs a terminal or the Convex dashboard. Maintenance jobs run from Settings, old screenshots tidy themselves away, a restore rebuilds its own boards, failed background jobs say so, extraction cannot overspend, and nothing here gives way at twenty seasons.

- Settings → Maintenance: each job, its last run, a check before anything changes.
- Nightly retention for finished screenshots, with the setting beside the jobs.
- A restored franchise rebuilds its boards and marks by itself.
- Failed scheduled jobs reach Settings → Errors by name, and errors can be marked seen.
- A monthly extraction budget: a banner at 80 percent, a hold at the limit.
- The same screenshot twice waits instead of being read.
- A 20-season scale test against Convex's function limits.
- Sprint 19's leftovers: the mark badge on a game and the missing-games count beside the lists.

**Done when:** every job in `PLATFORM-AUDIT.md` 1.6 runs from Settings with its last run shown, a restore leaves working records with nothing pressed, a job that fails shows up in Errors within fifteen minutes, a spent budget holds new screenshots and a higher one lets them go, a repeat image costs nothing, and the scale test passes in CI.

**As built:**

- `maintenanceRuns` holds each job's latest run per franchise. Rebuild stats reads `recordBuilds` instead, as that already had a run and a phase. The Rebuild stats button moved here from Data. The jobs' CLI entry points stay, as thin wrappers over the same functions.
- The history import stays in Real NFL history, and the player tidy in Player identity, where each has its own progress. **Two things stay CLI only**: `repairSeasonStatsTeams`'s `assign` (the panel lists who has no team, and Fix a misread name places them one at a time) and `fixMisreads`'s `sourceId` and `intoId` for players sharing a name, where the sheet sends the owner to the player page.
- Fix a misread name takes one fix at a time, where the CLI took a list.
- **Milestones are not archived**, against `PLATFORM-AUDIT.md` 6.4: since Sprint 19 they are a player's timeline. The feed's index only sees unacknowledged ones, so their number costs nothing.
- **No thumbnails**, against `PLATFORM-AUDIT.md` 6.1. Convex cannot resize an image without a Node action, and a browser-made one would miss the Shortcut. A set past retention goes whole, upload rows and reads with it, as Delete in the inbox does. Corrections keep their numbers and lose only the link back.
- Retention defaults to 180 days, 30 for rejected, and `keepScreenshotsDays: 0` keeps everything. A failed or unreviewed set is never touched, however old. Screenshots are not in backups, so this cannot be undone. **The first nightly run after deploying deletes anything already past 180 days.**
- `tidyFranchise` runs 25 sets a step and reschedules. The cron only schedules a step per franchise, so a failure lands in Errors with the rest.
- The sweep reads `_scheduled_functions` every 15 minutes, which needs no wrapper around any job. Cron runs are not in that table, so the nightly backup is now a cron that schedules the action. A failure counts once: only one newer than the report's `lastSeen` adds to it. A failed extraction is caught by its own run and stays in the inbox, not here.
- The budget is per franchise, like the models it pays for, in UTC months. `usageMonths` is added to when a run saves, because reading a month of `extractions` could pass the 16 MB read limit. **It counts from this deploy, and only runs that saved with a cost**: a run that failed on the model still spent money OpenRouter knows about and this does not. Treat the budget as a guard, not a ledger.
- Held sets stay `queued` with `hold: "budget"`, and start again by themselves when the budget is raised or the nightly tidy finds room. That spends without asking, on screenshots the owner already sent.
- Repeats are found by SHA-256 of the file as picked, before `prepareImage` re-encodes it, or two copies could differ. A repeat is stored and held rather than refused, which works the same for the web, the Shortcut and the offline queue, and leaves the choice in the inbox. A repeat inside a set holds the set. The Shortcut's response gains `duplicate`. Older uploads have no hash, and a deleted upload no longer counts.
- A restore finishes with `restoreData:rebuild`, from the `logs` phase, so an older backup's rows catch up. Rebuild stats now also rewrites `scoringBoards`, which had no rebuild.
- `scale.test.ts` seeds 20 seasons of 19 games and 24 lines, then meters a `ctx` against Convex's limits, since convex-test enforces none. The heaviest steps: after a game 5,867 documents and 4.0 MB, a page of marks and spans 8,765 and 4.9 MB, both well inside 32,000 and 16 MB. **It cannot see the time limit**: real opponents' lines add to these, and a mutation's one second is only proven on a deployment. `MAX_PLAYER_LINES` holds a 20-season career.
- `e2e/fixtures.ts:png()` gives every test upload its own bytes, or the inbox would hold them as repeats.
- The mark badge sits in the game log's Marks column, and chips above the box score. The missing-games count shows on Records, not Team records, which read scores, and on Streaks. It reads one line per game of every season, so it stays off Home.
- Left for later, from the same audit rows: per-set cost caps, backoff on 429s, a "retry all failed" action, the commit summary, a bundle size budget and the PWA update toast.
- Playwright tests are written and left to CI, as the Mac's swap was full again; the phone project has not run them, nor Sprint 19's. Checked by hand at 375 x 812 and desktop width in light: Maintenance, the budget banner and form, the fix sheet, and the marks above a box score. The duplicate hold in the inbox was checked only by tests, as was the game log badge, which sits in the phone's expanded row.

---

## Proposed: Sprints 21 to 23

Planned after the platform audit of October 2026, not yet scheduled or built. The statistics hub plan is `docs/STATS-HUB.md`; the audit with every gap and the reasoning behind the order is `docs/PLATFORM-AUDIT.md`. When one of these is picked up, it gets a full section above with a goal, a "Done when" and, once built, its "As built" notes, and the stable behaviour moves into `FEATURES.md`.

| Sprint | Theme | Size | Source |
|---|---|---|---|
| 21 | Splits and the stat explorer | M | `STATS-HUB.md` 8, Sprint 18 |
| 22 | Fun layer: season recaps, awards race, rivalry pages, weekly digest, Hall of Fame cases, contract year | M | `PLATFORM-AUDIT.md` 5.2 |
| 23 | Spec sweep: Appearance and franchise settings, swipe between weeks and seasons, long-press row actions, headshot upload, Shortcut test button, ratings capture | S | `PLATFORM-AUDIT.md` 5.1 |

---

## Later (not scheduled)

- Drive charts, if a Madden screen provides drive data cleanly (scoring plays are Sprint 14).
- Shareable read-only season recap pages.
- Live Text on-device OCR as a pre-pass to improve digit accuracy.

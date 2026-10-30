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

## Proposed: Sprints 14 to 22

Planned after the platform audit of October 2026, not yet scheduled or built. The statistics hub plan is `docs/STATS-HUB.md`; the audit with every gap and the reasoning behind the order is `docs/PLATFORM-AUDIT.md`. When one of these is picked up, it gets a full section above with a goal, a "Done when" and, once built, its "As built" notes, and the stable behaviour moves into `FEATURES.md`.

| Sprint | Theme | Size | Source |
|---|---|---|---|
| 14 | Stats engines and storage: running totals, marks ("fastest to"), best N-game spans, pace, year over year, splits, quarter scoring, team records, streaks with dates | M | `STATS-HUB.md` 8, Sprint 14 |
| 15 | Identity for the created era: player provenance and a real derived `isReal`, proper name splitting and alias search, game-aware name resolution, draft class matching, commit guards for new and ambiguous names, identity tools over every player | M | `PLATFORM-AUDIT.md` 2.2 A to D, G, H |
| 16 | Stats hub: Overview, pace columns and the Home pace line, Countdowns card, Trends view, player page Pace, Trends and Cumulative | M | `STATS-HUB.md` 8, Sprint 15 |
| 17 | Roster truth and the season checklist: the roster page as the truth for a team and season, carry-over that ages contracts and prunes ghosts, retirements step, depth chart, roster diff, team switcher, coverage strip | M | `PLATFORM-AUDIT.md` 2.2 E, F and 3 |
| 18 | Records and streaks depth: fastest-to and span lists, full single-game lists, team records, streak dates and new kinds, milestone timeline, imported league leaders with "where we rank", player milestones | M | `STATS-HUB.md` 8, Sprint 16 |
| 19 | Operations without a terminal: maintenance panel, retention crons, boards rebuilt after restore, scale test on a synthetic 20-season franchise, scheduled-job errors surfaced, extraction budget, duplicate screenshot hash | S | `PLATFORM-AUDIT.md` 4 and 6 |
| 20 | Splits and the stat explorer | M | `STATS-HUB.md` 8, Sprint 17 |
| 21 | Fun layer: season recaps, awards race, rivalry pages, weekly digest, Hall of Fame cases, contract year | M | `PLATFORM-AUDIT.md` 5.2 |
| 22 | Spec sweep: Appearance and franchise settings, swipe between weeks and seasons, long-press row actions, headshot upload, Shortcut test button, ratings capture | S | `PLATFORM-AUDIT.md` 5.1 |

---

## Later (not scheduled)

- Scoring plays and drive charts if a Madden screen provides them cleanly.
- Shareable read-only season recap pages.
- Live Text on-device OCR as a pre-pass to improve digit accuracy.

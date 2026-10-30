# Platform audit: gaps and recommendations

A whole-app review at commit `b1b4c36` (after Sprint 13), read against `FEATURES.md`, `SPRINTS.md`, the schema, the Convex functions and the screens, with one franchise in mind: a single owner, 15 to 20 seasons, where by year 10 nearly every player is a Madden-created one. The statistics hub has its own plan (`docs/STATS-HUB.md`); this document covers everything else, in priority order, and proposes the sprints after it.

Status words: **built**, **partial**, **missing**, **risk** (works today, fails later).

---

## 1. The ten things that matter most

1. **Created players are stored as real** (`isReal: true` in `convex/ingestion/rowPlayers.ts`, `commitDraftResults.ts`, `transactions/people.ts`). By year 10 the roster is mostly fictional players that the app thinks are real: every one of them is queued for an ESPN face match, shows a broken headshot path until matched, and pollutes merge suggestions. Fix: provenance on the player (`origin: import | draft | screenshot | manual`, `isReal` derived, defaulting to fictional for anything created after the franchise's first draft unless matched to ESPN).
2. **Draft results never match existing players and recommitting duplicates them** (`spec.newPlayers` skips resolution in `extract.ts`). Fix: match draft rows against players already created this season (a prospect typed in earlier, a misread recommit) by name plus college plus position, and make the draft commit idempotent on `(seasonId, overall)` by reusing the pick's existing player.
3. **Names are stored as printed.** "M.Hawkins" becomes `lastName: "M.Hawkins"`, `firstName: ""`, and the alias search only indexes `displayName`. Fix: split with `shared/players/identity.ts:splitDisplayName`, keep the printed form as an alias, index aliases for search, and promote the full name the first time a fuller source (roster page, player card, draft highlight) shows it.
4. **Nothing retires, releases or ages out other teams' players.** Carry-over copies every non-released entry forward every season, ingested transactions never touch rosters, and per-team reads stop at 150 entries (`carryOver.ts`, `candidates.ts`, `roster.ts`, `directory.ts`, `cap.ts`, `headshots.ts`). After a few seasons opponents' rosters are hundreds of ghosts, the resolver's candidate pool is wrong, and entries past 150 vanish silently. Fix: section 3.
5. **Ambiguous box-score names commit as new players** when review does not pick, and the weekly-awards batch auto-commits "will be added as a new player" rows unseen. Fix: ambiguous and new names block commit on game targets until confirmed or explicitly "create", and new-player rows are never auto-committed.
6. **Several maintenance steps are CLI only** (`stats/rebuild:all`, `stats/recordBuild:start`, `stats/teamTotals:rebuildAll`, `games/clearTypedStarLines`, `history/importJob:restart`, `ingestion/fixMisreads`, `repairSeasonStatsTeams`). The owner should never need a terminal. Fix: a Settings → Maintenance panel with each job, its last run and a progress row, built on the `recordBuilds` pattern.
7. **Boards and placements are not backed up** and depend on a first build the user has to know to press. Fix: back them up or rebuild automatically after a restore and after the history import (the import already schedules `recordBuild`; make the restore do the same).
8. **No statistics beyond totals**: no pace, trends, cumulative, splits, spans or fastest-to (`docs/STATS-HUB.md`).
9. **Spec items still missing on screens**: roster team switcher, depth chart, roster diff, imported league leaders view with "where we rank", player milestones on the player page, Appearance settings, franchise settings editing, swipe between weeks and seasons, long-press row actions.
10. **Long-franchise scale is untested.** The after-game refresh and the records build were timed on the sample only ("full-history franchises were not timed"). Fix: a synthetic 20-season fixture and a timing test in CI (section 6).

---

## 2. Player identity and created players

The franchise's centre of gravity moves from real players to created ones around year 5 and is almost entirely created by year 10. Everything below is about making that second decade as good as the first.

### 2.1 Findings

| Area | Status | Detail |
|---|---|---|
| Provenance | missing | No `origin` field. "Captured" is inferred from `nflverseId === undefined`; `fixMisreads` guesses from `_creationTime`. |
| Real or fictional | risk | Every screenshot-created player is `isReal: true`. `FaceMatchSheet` lists all of them; the monogram card only appears after a manual "mark fictional". |
| Name storage | risk | Verbatim printed name, naive whitespace split; no first name for initial-only prints. |
| Alias search | missing | `search_displayName` indexes `displayName` only; the fuzzy pool's text fallback searches the last token of the display name (5 hits). |
| Resolution pool | partial | The two teams the model read (not the scheduled opponent) plus the text fallback; released and traded entries are in the pool; no jersey numbers (the schema has none). |
| Remembered assignments | built | Per franchise, season, team and normalized name; written on commit and on review changes. Not carried across seasons. |
| Draft results | risk | Never resolved; recommit duplicates; `ageAnchor` not set; `isReal` stays true unless matched to a college prospect. |
| Ambiguous names | risk | Warning only on box scores; commit creates a new player. Weekly awards batch auto-commits new-player rows. |
| Retirement | partial | Manual flag, manual `retire` transaction, import's `!active`. Ingested transaction screens apply nothing. |
| Carry-over | risk | Copies contracts without decrementing years, OVR and dev trait unchanged, every other team too; 150-entry cap per team. |
| Duplicate detection | partial | First 400 captured players only (`identity.duplicates`), same position group, score 0.93. |
| Name corrections | partial | `nameCorrections` reads `game_box_score` corrections only, not `game_log` (the default target) or row targets. |
| Depth chart | missing | `depthSlot` is never written. |
| In-season OVR | partial | Snapshots are typed by hand; roster page and player card overwrite the season OVR without a week. |
| Player card | partial | Captures bio, OVR, dev trait, contract, abilities; no ratings beyond OVR. |
| Headshot upload | missing | Deferred since Sprint 4; nothing writes `headshotStorageId` except ESPN caching. |

### 2.2 Recommendations

**A. Player provenance and realness (S).** Add `origin` (`import`, `roster_import`, `draft`, `screenshot`, `manual`, `restore`) and `createdSeasonId`. Derive `isReal`: imported and ESPN-matched players are real; anyone created from a draft class after the franchise start, or from a screenshot in a season after year one with no ESPN match, is fictional until matched. Backfill with a one-time job offered in Settings. The face-match sheet then lists only plausible candidates (first-season captures and imports without an id).

**B. Names done properly (S).** Use `splitDisplayName` everywhere a player is created; keep the printed string as an alias; index aliases (`aliasesText` field for the search index, or a separate `playerAliases` table indexed by `(franchiseId, normalized)`); a "name upgrade" rule: when a fuller source commits a name that is an initials-match of a one-initial player on the same team and position, rename and keep the alias (today only the review merge does this).

**C. Game-aware resolution (M).** The resolver should start from the scheduled game: the user team's roster plus the scheduled opponent's roster (`games.opponentTeamId`, from `leagueGames`), active entries first, released and traded last, players retired excluded. Carry remembered assignments forward: when season N+1 has no assignment for a name, use season N's for the same team. Add a per-team "this is who they are" panel on review: the opponent's known roster at that position, so a one-tap pick beats typing.

**D. Draft class ingestion (M).** Resolve draft rows against players created this season (manual, prospects already picked, earlier partial reads) by name, college and position; idempotent per `(seasonId, overall)`; set `ageAnchor` from the age column; set `origin: draft` and fictional unless matched; default jersey unknown. Add a "Draft class" step to the season-start checklist (section 4) so every rookie exists before week 1 box scores name him.

**E. Roster truth per season (M).** The roster page target becomes authoritative for the team it shows: after commit, entries for that team and season not on the screen are marked `released` as of that week (with an undo list in the review summary). Carry-over decrements contract years, drops expired contracts to "unsigned" status for the user team (a prompt to re-sign or release), and for other teams carries only players seen in the last two seasons (a `lastSeenSeasonId` on the player, updated by any commit that names him). Lift the 150 caps to paginated reads or raise them with a test that proves the number.

**F. Retirement and ageing (S).** A yearly "retirements" step at season start: players over an age threshold with no entry in the new season's roster capture get a suggested `retired` flag (one list, accept all or pick); ingested `retire` transactions apply the flag; the Hall of Fame sheet proposes candidates from retired players with placements.

**G. Commit guards (S).** Game targets refuse to commit while any line is ambiguous or new without a decision; a "Create as new" action per line records the decision; the weekly batch excludes sets with new-player rows from auto-commit.

**H. Identity tools (S).** `duplicates` paginates all captured players; `nameCorrections` reads every target; a per-player "seen in" list (games, screens, seasons) so a merge can be judged; merge suggestions surface on the player page when a likely duplicate exists, not only in Settings.

**I. Ratings and progression (M).** Extend the player card target with the Madden ratings block (speed, acceleration, strength, awareness, the position key ratings) into a `playerRatings` table per season and week; the roster page target writes an OVR snapshot with the week so in-season progression comes from screenshots, not typing. A "ratings diff since last capture" on the player page.

**J. Manual headshot upload (S).** A storage upload from the player page (and a paste target), re-encoded in the browser like captures, so a created star can have a face.

---

## 3. Memory and context: what the app should know without being told

The owner's point: by the second decade the app, not the owner, has to remember who everyone is and what is going on.

| Context | Status | Recommendation |
|---|---|---|
| Who we play this week | built | `leagueGames` plus the nflverse schedule import give the opponent; the capture sheet infers the week. Make the resolver use it (2.2 C) and show "Week 9 vs MIA: 53 known players" on the capture sheet. |
| Who is on the opponent | partial | Partial entries from box scores, leaders, awards and the first-season import; no decay. 2.2 E. |
| Our depth chart | missing | Write `depthSlot` from the roster page target's order and show a depth chart view (FEATURES 5.3). |
| Season checklist | missing | A per-season **Season checklist** on Home: offseason (re-signings, free agency, draft class, roster page, carry-over), preseason (depth chart, goals, pre-season report), each week (game log, standings, weekly awards), season end (season stats for each group, team stats, standings, awards, playoffs, post-season report). Each item knows which target satisfies it and shows done or missing from the data, not from a checkbox. It replaces remembering which screens to shoot. |
| Capture freshness | partial | The reconcile view lists weeks without a box score. Generalize: a "coverage" strip per season (games with a box score, with team stats, with a line score, standings weeks captured, awards weeks captured). |
| Season switch defaults | built | Remembered per screen. Fine. |
| Context on a player | partial | The player page has bio, career, moves. Add "how we got him and why" (acquisition story plus the need it resolved, the draft board note, the trade's retrospective), the milestone timeline (STATS-HUB 4.2) and "seen in" (2.2 H). |
| Franchise memory | partial | Timeline exists. Add season recaps generated from the data (section 5 B) and an "on this week" card on Home (what happened in week N of earlier seasons). |

---

## 4. Ingestion and the weekly loop

| Item | Status | Recommendation |
|---|---|---|
| Full game log from photos | built | Works end to end. |
| Duplicate screenshot | missing | Hash uploads (SHA-256 in the browser and the Shortcut path) and refuse or warn on a repeat image in the same franchise. |
| Cost guard | partial | Usage panel exists; no monthly budget, no per-set cap. Add a soft monthly budget in Settings with a banner at 80 percent and a hard stop that queues instead of extracting. |
| Retry policy | partial | Fallback model and watchdog exist. Add exponential backoff on provider 429 and 5xx, and a "retry all failed" action. |
| Review speed | partial | Keyboard commit, select all. Add: tab order through low-confidence fields only, a numeric keypad on phones, "accept the model's number" per field with one key, and a diff view when re-running (old draft against new). |
| Commit transparency | partial | Add a commit summary sheet: players created, aliases added, roster entries created, records broken, milestones, with undo for the whole commit (today only the game can be deleted). |
| Season-end batch | partial | Weekly awards batch exists. Generalize the batch page to any season-scoped row target: season stats for every position group as one batch, league team stats tabs as one batch, standings plus playoffs as one batch. |
| Box score coverage | built | Reconcile view. Keep. |
| Offline capture | built | Queue and flush exist; not e2e tested end to end. |
| Shortcut | built | Hand-built from docs by design. Add a "test endpoint" button in Settings (FEATURES 5.12). |
| Live Text OCR | later | Still worth it for digits: a pre-pass that gives the model the OCR text alongside the image improves numbers for little cost. |

---

## 5. Features: gaps against the spec and the fun that is missing

### 5.1 Spec items not built

| Area | Item | Status |
|---|---|---|
| Roster 5.3 | Team switcher for other teams' rosters | missing (`roster.bySeason` takes `teamId` but no UI) |
| Roster 5.3 | Depth chart view | missing (nav description claims it) |
| Roster 5.3 | Roster diff between two seasons | missing |
| Player 5.4 | Milestones list on the player page | missing |
| Player 5.4 | Manual headshot upload | missing |
| Stats 5.5 | Imported league leaders top 20 with "where we rank" | missing (the table exists; no screen) |
| Settings 5.12 | Appearance (team colour intensity, density, reduced motion) | missing |
| Settings 5.12 | Edit franchise team, start year, season length, playoff format | missing |
| Settings 5.12 | Temperature and token budget | missing |
| Settings 5.12 | Shortcut test endpoint | missing |
| Phone 5.13 | Swipe between weeks on Schedule and seasons on History | missing |
| Phone 9 | Long-press row actions | missing |
| Keyboard 5.14 | `[` `]` between weeks on Schedule | partial (games only, on game detail) |
| Later | Scoring plays, drive charts, shareable recaps | missing |

### 5.2 Additions that make the franchise more fun

- **A. Season checklist and coverage strip** (section 3): the app tells you what to shoot next.
- **B. Season recap pages**: a generated recap per season (record, how it went week to week, stars, awards, records set, moves, draft, the report's own words), shareable as a read-only page later. Mostly composition of existing queries.
- **C. Countdowns and "on this week"** on Home (STATS-HUB 7).
- **D. Awards race**: during the season, MVP, OPOY, DPOY and OROY leaderboards from our players' numbers against the imported league leaders, with the counted awards' rules.
- **E. Contract and cap year**: expiring contracts list with re-sign or let go actions that log the move; a cap projection for next season; carry-over asks about expiring deals.
- **F. Draft day**: the board drives a live draft screen (our picks, needs met, prospects taken by others), feeding `draft_results` later; class retrospectives already exist.
- **G. Rivalry pages**: rivals view plus a rivalry page per opponent (every meeting, playoff meetings, streaks, our best performers against them, the team records against them).
- **H. Hall of Fame cases**: a "case" panel on the induction sheet from placements, awards, marks and seasons with the team; a yearly "eligible" list of retired players five seasons out.
- **I. Jersey numbers**: track numbers per season (already on the entry) and show retired-number conflicts and "who wore 12" on the HoF wall.
- **J. Coaching trees**: staff per season exists; add a coaching record table (wins per head coach, playoff record) and a coordinator timeline.
- **K. Weekly digest**: after each commit, Home shows a one-week recap card (result, stars, records, milestones, streaks, standings move) that can be copied as text.
- **L. Compare anything**: extend compare to seasons (2027 team against 2031 team) and to a player against a franchise legend at the same age.
- **M. Phone capture ergonomics**: a "last week's game" quick action on the capture button; the inbox picker surfaces the newest screenshots first with the week guessed.

---

## 6. Infrastructure, scale and maintainability

(Verified from the code; the infra numbers are estimates for a 20-season franchise.)

### 6.1 Growth by season 15

| Table | Rows by season 15 (estimate) | Reads that touch it | Risk |
|---|---|---|---|
| `gameStatLines` | 15 seasons × 20 games × ~80 lines ≈ 24,000 | by player and season (40), by game | fine |
| `rosterEntries` | 15 × 32 × 60 (growing with ghosts) ≈ 29,000 plus | per team and season `take(150)` | **cap hit on other teams**; user team fine |
| `seasonPlayerStats` | 51,000 imported + 15 × ~120 ≈ 53,000 | per season and team (300), per player (120) | fine |
| `players` | 16,500 + ~300 created per season ≈ 21,000 | search, pagination | fine; `duplicates` scans 400 only |
| `recordPlacements` | 3 books × 2 splits × 3 scopes × 48 stats × 20 ≈ 17,000 max | by player | fine |
| `leagueGames`, `standings` | 15 × 272, 15 × 32 | by season | fine |
| `milestones` | a few hundred per season | by franchise and acknowledged (30) | fine; acknowledged ones never archived |
| `uploads`, storage | every screenshot kept until deleted by hand | inbox Done list | storage grows for the life of the franchise; add retention (delete committed images after N days, keep a thumbnail) |

### 6.2 Bounded reads that scale with seasons

- `MAX_PLAYER_LINES = 600` in `convex/stats/load.ts` covers 20 seasons of 20 games plus playoffs for one player; keep, but assert in a test with the synthetic fixture.
- `MAX_ROSTER = 150` in six files: one constant in `convex/lib/franchise.ts`, raised or paginated, with ghost pruning (2.2 E) as the real fix.
- `MAX_SEASONS = 150` (1920 onward) fine.
- `league/teamStats.ts` `MAX_ROWS = 2000` reads the user team's captured season stat rows only (16 stats × seasons): fine.
- `players/player.ts` `MAX_ROWS = 160` season rows per player: fine.

### 6.3 Refresh cost

`refresh:afterGame` loads each box-score player's full career lines (bounded), re-ranks the franchise book from the user team's season rows (every season, 300 rows each), and schedules the board merge. Linear in seasons; fine to 20. The records rebuild paginates. The risk is untested, not architectural: add `convex/stats/scale.test.ts` that seeds 20 synthetic seasons and asserts the after-game refresh and a board rebuild finish inside the function limits.

### 6.4 Operations

- Backups nightly, fourteen kept, restore as a new franchise: good. Boards, placements and `manualDrafts` are excluded; rebuild after restore is manual (fix in 1.7).
- Nothing archives acknowledged milestones, finished uploads or old extraction rows; add retention jobs in `crons.ts`.
- Error reports are capped at 100 and can be cleared; add "mark seen" so a recurring error stands out from a known one.
- No backend error surface for scheduled work (a failed refresh is invisible outside the Convex dashboard): record scheduled-job failures into `errorReports` with the function name.

### 6.5 Client

- Route code splitting is on; Recharts loads with the first chart. Fine.
- The offline cache is bounded (300 entries, 750,000 characters, oldest evicted): fine. Add an age bound so a screen seen months ago is not served as current.
- No bundle size budget in CI: add `vite build` size reporting with a threshold.
- The PWA auto-updates; add a "new version" toast so a phone does not sit on an old build mid-review.

### 6.6 Code health

- 76,000 lines across `shared`, `convex` and `src`; the largest source file is 305 lines (`shared/stats/registry.ts`), everything under the 300-line lint warning except the generated route tree. No TODOs anywhere. Coverage of `shared/` 96.7 percent.
- 124 test files (64 shared, 46 Convex, 20 Playwright). CI runs format, typecheck, lint, unit, Convex, build and desktop Playwright; phone Playwright is local only (by design, free plan).
- Stale text: comments and `SPRINTS.md` still say "top ten" where the code keeps twenty; `gamesStarted` is in the schema and never written; `pace()` is unused.

### 6.7 Testing gaps

- Player page identity tools, ESPN match sheet, OVR checkpoints, Settings data and identity panels, game detail editors (quarters, team stats, add or remove lines), the offline capture queue, keyboard shortcuts other than ⌘K, compare's radar and split, carry-over and face match: no Playwright coverage.
- No scale test (6.3), no restore-then-rebuild test, no test that a recommitted draft class does not duplicate players (it does today).

---

## 7. Proposed sprint order after Sprint 13

| Sprint | Theme | Size | Contents |
|---|---|---|---|
| 14 | Stats engines and storage | M | `STATS-HUB.md` Sprint 14 |
| 15 | Identity for the created era | M | 2.2 A, B, C, D, G, H: provenance, names, game-aware resolution, draft matching, commit guards, identity tools |
| 16 | Hub overview, pace, trends | M | `STATS-HUB.md` Sprint 15, plus Home countdowns |
| 17 | Roster truth and the season checklist | M | 2.2 E, F; section 3 checklist and coverage strip; depth chart, roster diff, team switcher |
| 18 | Records and streaks depth | M | `STATS-HUB.md` Sprint 16, league leaders view with "where we rank", player milestones |
| 19 | Operations without a terminal | S | Maintenance panel, retention crons, backup of boards or auto-rebuild, scale test, error surfacing, budget guard, duplicate image hash |
| 20 | Splits and the explorer | M | `STATS-HUB.md` Sprint 17 |
| 21 | Fun layer | M | Season recaps, awards race, rivalry pages, weekly digest, HoF cases, contract year |
| 22 | Spec sweep | S | Appearance and franchise settings, swipe weeks and seasons, long-press actions, headshot upload, Shortcut test button, ratings capture |

Identity (15) is placed second on purpose: every stats feature after it is only as good as the player entities it ranks, and the cost of fixing identity grows with every season captured under the current rules.

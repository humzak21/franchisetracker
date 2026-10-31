# FranchiseTracker — Feature Specification

A Football Manager style front end for a Madden franchise, minus the game. One user, one franchise at a time (the model supports several), fed by photos and screenshots the user takes during and after each game, parsed into structured data, and reviewed before commit.

It is built for **new franchises**. A franchise starts in the current real-life NFL season. Everything before that (real team records, standings, playoff results, real players' careers) is imported from nflverse (`docs/NFL-HISTORY.md`); everything from the first franchise season on is captured as the user plays. There is no spreadsheet or workbook import, and there never will be.

This document is the product source of truth. `SPRINTS.md` turns it into build order.

---

## 1. Principles

1. **Game logs are the source of truth.** Every season total, career total, record, streak, highlight and leaderboard is derived from per-game stat lines. The user never types a season total. Season-level totals are imported only for real NFL seasons before the franchise began (section 4.8) or to reconcile a missed game.
2. **One definition per stat.** A single stat registry (`shared/stats/registry.ts`) declares every stat once: key, label, abbreviation, position group, formatter, aggregation (sum, max, rate), elite threshold, sort direction, and the extraction field it maps to. Tables, highlights, leaderboards, records, player pages, extraction JSON schemas and the real-history importer all read from it. Adding a stat is one registry entry.
3. **One definition per ingestion target.** An ingestion target registry declares each kind of screenshot once: name, which season/week context it needs, its JSON schema, prompt template, review form, and commit mutation. The Shortcut menu, the inbox tag list, the extraction action and the review UI are all generated from it.
4. **Structured first, prose alongside.** Nothing is stored as text with numbers inside ("Maye - 20/26, 203 yds, 2 TD", "27.3 - T-3rd", "Raiders (0-0)", "D 2024"); those are typed fields (section 6). Free-text notes stay, as their own field, everywhere the user wants to write.
5. **Players are entities, not strings.** A player exists once league-wide with stable identity across seasons, teams, jersey changes and name typos. Rosters, stat lines, awards, draft picks, transactions and Hall of Fame entries reference the player id.
6. **Review before commit.** Nothing parsed from an image lands in canonical tables without the user confirming it. Corrections are stored and reused as few-shot examples, which is how extraction improves over time.
7. **Beauty is a requirement.** Dark broadcast-graphics aesthetic, team-color accents, tabular numerals, dense but breathable tables, meaningful motion, and purposeful charts. Every screen has an empty state and a loading state that look intentional.
8. **Mobile is a full client, not a companion.** Every screen, table, chart and action in this document exists on the phone with the same data and the same capabilities. The phone is not just the camera. Legibility of dense data on a 390 px wide screen is a design problem solved per component (see section 9), never by hiding columns the user cares about or by pointing them at the desktop.

---

## 2. Platform and architecture

| Layer | Choice | Notes |
|---|---|---|
| Front end | Vite, React 19, TypeScript, TanStack Router, TanStack Table, TanStack Query is not needed (Convex handles data) | One responsive codebase. Installed as a PWA on the Mac (Safari or Chrome) and on the iPhone home screen. Optional Tauri wrapper for the Mac later. |
| Styling | Tailwind v4, shadcn/ui primitives, Radix, Lucide icons, Recharts | Design tokens in CSS variables; team colors injected at runtime. |
| Backend | Convex: database, file storage, actions, HTTP endpoints, scheduled functions | Single deployment. Schema split by domain under `convex/`. |
| Shared logic | `shared/` TypeScript package consumed by both `convex/` and `src/` | Stat registry, stat math (passer rating, averages, pace), formatters, validators, ingestion target registry. |
| Vision extraction | OpenRouter from a Convex action, structured output with a JSON schema per target, model fallback chain | Key stored as a Convex env var. Never on the client. |
| External data | nflverse public data releases for real NFL history (4.8, `docs/NFL-HISTORY.md`); the ESPN unofficial site API for headshots, logos, player search and bios | All fetched by Convex actions and cached in Convex. |
| Phone | The same web app as a home-screen PWA with full feature parity, plus an Apple Shortcut on the share sheet and home screen that posts images to a Convex HTTP endpoint with a bearer token for the fastest capture path. | Zero native code. |
| Auth | The entire app sits behind **Sign in with Vercel** (OIDC). Convex validates the Vercel ID token (`convex/auth.config.ts`) and every public function requires the signed-in user, checked against an allowlist of the owner's Vercel account. Nothing renders before sign-in except the sign-in screen. The Shortcut HTTP endpoint is the one exception and uses a revocable bearer token. | Franchise data is private. Hiding the front end is not enough on its own: the Convex URL is public, so the check lives in the backend. |
| Hosting | Vercel for the static front end (production branch `main`; the build runs `convex deploy` against the production deployment), Convex cloud for the backend | Any device can open the URL, and signs in before seeing anything. |

### 2.1 Repository layout

```
franchisetracker/
  convex/
    schema/            one file per domain, composed in schema.ts
    lib/               auth helpers, validators, pagination, error helpers
    franchise/         franchises, seasons, settings
    league/            teams, standings, league leaders
    players/           players, roster entries, contracts, headshots
    games/             games, stat lines, team game stats
    stats/             season/career aggregation, records, streaks, milestones
    awards/
    draft/
    transactions/
    reporting/         season notes, prompts, needs checklist
    hof/
    ingestion/         uploads, inbox, extraction action, review, commit, corrections
    external/          openrouter.ts, espn.ts
    http.ts            Shortcut endpoint
    crons.ts
  shared/
    stats/             registry.ts, math.ts, format.ts, thresholds.ts
    ingestion/         targets.ts (registry), schemas/ (JSON schema per target)
    domain/            enums: positions, position groups, acquisition types, award types, playoff rounds
  src/
    app/               router, providers, shell (sidebar, top bar, season switcher, command palette)
    design/            tokens.css, theme.ts (team colors), typography, motion
    components/
      data/            DataTable, StatCell, RankBadge, Highlight, Sparkline, Trend, EmptyState
      player/          PlayerChip, PlayerCard, Headshot, PositionBadge
      team/            TeamLogo, TeamChip, ScoreBug
      layout/          SplitPane, Section, Toolbar, Page
      forms/           NotesEditor, Checklist, SeasonWeekPicker
    features/
      dashboard/  schedule/  game/  roster/  player/  stats/  league/  history/
      reporting/  awards/  draft/  transactions/  hof/  ingestion/  settings/  search/
    lib/               hooks, formatting, keyboard, convex client
  scripts/
    (dev and ops scripts: local auth setup, Vercel build)
  docs/
```

Rules: features import from `components/` and `shared/`, never from each other. Anything used by two features moves down a layer. Convex functions are thin: validation, auth, data access, and calls into `shared/` for math.

---

## 3. Information architecture

Sidebar (team-colored), always visible:

1. **Home** — dashboard for the active season
2. **Schedule** — week list, calendar, game detail
3. **Roster** — current roster, depth by position, other teams
4. **Players** — search, player pages, compare
5. **Stats** — season stats, league leaders, team stats, records
6. **League** — standings, playoff bracket, other teams' history
7. **History** — franchise history, trophy room, season reports, Hall of Fame
8. **Awards**
9. **Draft**
10. **Transactions**
11. **Inbox** — ingestion queue, with a badge count
12. **Settings**

Global: season switcher in the top bar (defaults to the active season, remembered per screen), command palette (`⌘K`) searching players, games, seasons, screens and actions, and a pending-prompt banner (preseason or postseason report due).

The sidebar's header is the franchise switcher: every franchise with its team and current season, and "New franchise".

On phones the sidebar becomes a bottom tab bar with Home, Schedule, Roster, Stats and a "More" sheet holding the franchise switcher and the rest, plus a floating capture button that opens the inbox uploader. The season switcher moves into the page header, and the command palette is reachable from the search icon in every page header (no pull-down gesture: section 9 keeps pull gestures off to avoid accidental triggers).

---

## 4. Data model

All tables carry `franchiseId`. Years are integers (`2025`). Weeks use a `weekKey` enum: `pre1..pre3`, `w1..w18`, `wc`, `div`, `conf`, `sb`, `probowl`.

### 4.1 Franchise and seasons

- `franchises`: name, userTeamId, startYear (the real NFL season the franchise begins in), settings (games per season, playoff teams, elite thresholds overrides), active flag. Created by the setup flow (5.0); its first season is created with it and later seasons when the user advances. Exactly one franchise is active; every screen, the inbox and the Shortcut endpoint read the active one, and switching never touches another franchise's data.
- `seasons`: year, status (`upcoming`, `regular`, `postseason`, `complete`), userTeam record cache (w, l, t, divisionRank, seed, playoffResult), the user team's season team stats derived from its regular-season games (`teamTotals`, refreshed with the record cache after every game write), coaching staff (head coach, OC, DC, offensive scheme, defensive scheme), salary cap, notes.
- `seasonGoals`: pre-season goals per season, in the owner's order: scope (team or player), type (wins, division, playoffs, bye, playoff win, Super Bowl appearance or win, stat, write-in), player and stat key for stat goals, target, text, and a manual hit/missed outcome that overrides what the numbers say.
- `seasonReports`: pre-season thoughts, post-season thoughts, around-the-league notes, status of each prompt (pending or answered with timestamp, plus when the banner was last dismissed), `needs[]` (position, priority, note, resolved by a transaction or draft pick id, or by hand with a note). Created on first write.

### 4.2 League

- `teams`: abbreviation, city, name, conference, division, colors, logo storage id, ESPN id. Seeded with all 32. Relocation or rename supported via `aliases[]` with year ranges.
- `standings`: per season per team: w, l, t, divisionRank, seed, playoffResult, pointsFor, pointsAgainst. Imported, captured from the standings screen, or worked out from league scores: once every team has played its regular season, worked-out rows get their division rank and seed (`shared/league/projection.ts`), and their playoff result as playoff scores arrive.
- `leagueTeamStats`: per season per team, every raw number of Madden's league team stats screen (offense, defense, conversions, red zone, turnovers tabs), keyed by `shared/stats/leagueTeamRegistry.ts`. Each captured tab merges into the team's row; percentages, offensive and return yards, yards allowed, points scored and allowed per game, point and yard differentials and turnover margins are derived, never stored, as is every per-game figure.
- `leagueLeaders`: per season, per stat key, ranked rows (rank, playerId or raw name, teamId, value). Top 20 per category.
- `teamSeasonStats`: per season per team per stat key: value, rank, attempts, note, from the team stats season screen or its manual entry. Replaces the "27.3 - T-3rd" strings. For the user team a row overrides the value derived from the games (`seasons.teamTotals`) and is the only source of league ranks.
- `leagueGames`: every game in the league for a week (away, home, scores when played, game time), from the Madden schedule screen (one week or several in one set), typed in, or a whole season's matchups loaded from the real NFL schedule (nflverse, never its scores) before kickoff. The user team's game also updates `games`. Every other team's standings record (W-L-T, points) is worked out from these scores plus the user team's games after any score changes; a captured standings record is only replaced when the scores cover at least as many games.

### 4.3 Players

- `players`: firstName, lastName, displayName, position, birthYear or age-at-year anchor, college, heightIn, weightLb, draft (year, round, pick, teamId) or undrafted, isReal, origin (import, draft, screenshot, manual), the season first seen, the last season a commit named them, espnId, headshot storage id, retired flag, devTrait, abilities[], aliases[] for name resolution and search, notes.
- `rosterEntries`: per season per team per player: jersey, position, depthSlot, ovr, age, exp, acquisition (type: draft, FA, trade, waiver, undrafted, resign; year; detail; counterparts), contract (years, total, apy, guaranteed, expiresYear), grade note, status (active, IR, PS, contract expired, released or traded away, with the week it took effect).
- `playerSnapshots`: optional mid-season OVR checkpoints (week, ovr) for progression charts.

### 4.4 Games

- `games`: season, weekKey, date label, homeTeamId, awayTeamId, userIsHome, scores, overtime, result for user team, opponent record at kickoff, playoffRound, stadium or neutral flag, weather, notes (narrative), stars[] (any number, ordered, picked by hand: playerId or typed name, team, optional note; the stat line is read from the box score, never stored), status (`scheduled`, `played`, `bye`).
- `gameStatLines`: per game per player per team: a flat map of stat keys from the registry (pass, rush, rec, def, kick, punt, return). One row per player per game. This is the source of truth for everything downstream.
- `gameTeamStats`: per game per team: first downs, total yards, pass yards, rush yards, turnovers, penalties, time of possession, third down, fourth down, red zone, sacks, etc.
- `scoringPlays`: every score of a game from Madden's scoring summary screen, rewritten as a set per game: order, period, clock, team, kind (pass, rush, field goal, safety, return or defensive touchdown), yards, scorer and passer as a player id and the name as printed (a scorer may be missing where the screen dropped the name, and is assigned afterwards), PAT result, score after, the description as printed. Source for the line score, game flow and clutch scoring (`docs/STATS-HUB.md` 4.10).

### 4.5 Derived and cached

- `seasonPlayerStats`: materialized per season per player per team totals, with games played, per-game averages and counts of threshold games (100-yard games, 300-yard games, 2- and 3-TD games, 5+ catch games, 2-sack and 2-INT games, perfect passer ratings), and the season high per stat with the game and week it came in (`bestGames`). Recomputed by a mutation after any stat line commit. Exists so tables and leaderboards are one indexed read.
- `careerPlayerStats`: same shape, per player, all seasons, with the team he played the most games for.
- `records`: franchise-era records per stat key per scope (single game, season, career), with holder, value, game or season reference, date set, previous holder, and the top 20 behind it. Recomputed incrementally.
- `scoringBoards`: the scoring records (`shared/stats/scoringBoards.ts`), top 20 per list and split, rebuilt from `scoringPlays` whenever a game's plays change.
- `playerMarks`: every mark a player has reached ("fastest to"), per career, season and stint with the team, with the game and games taken. `spanBoards`: the best N-game stretches per stat and window, each split apart. `teamRecords`: the team's best and worst games and seasons per stat. All three are worked out from the logs and rebuilt by Settings → Maintenance → Rebuild stats (`shared/stats/marks.ts`, `spans.ts`, `teamRecords.ts`).
- `recordBoards`: the team and all-time books (`shared/stats/recordBoards.ts`), the best 25 entries per book, split, scope and stat; built once by `stats/recordBuild` and merged per game. `typedRecords`: numbers typed by hand into either book. `recordPlacements`: every list a player makes, for his page.
- `milestones`: detected events (first 1000-yard season, career high, franchise record broken, streak reached) with week and acknowledgment flag. Feed the dashboard.

### 4.6 Awards, draft, transactions, Hall of Fame

- `coaches`: coaches created in the franchise for Coach of the Year (name, optional team); the bank of real head coaches is `shared/domain/coaches.ts`. A Coach of the Year award stores the coach's name and team, no player.
- `awards`: season, weekKey or null, scope (league, conference, team), type (OPOW, DPOW, STPOW, ROW, MVP, OPOY, DPOY, OROY, DROY, CPOY, COY, SBMVP, ProBowl, AllPro1, AllPro2, BestK, BestP, BestKR, BestQB, BestRB, BestWR, BestTE, BestOL, BestDL, BestLB, BestDB, the counted FPOY, SackLeader, BallHawk, HeatSeeker, MostOPOW, MostDPOW, custom), conference, playerId or raw name plus teamId, statLine text, notes.
- `draftPicks`: season, round, pick overall, pick in round, teamId, playerId, position, ovr at draft, college, notes, trade note, origin pick (acquired from), retrospective grade (computed later from OVR progression and starts).
- `draftPickInventory`: future picks that changed hands (acquired by the user team, or traded away), with origin team and how; any pick without a row is the team's own.
- `draftBoard`: prospects noted for a draft, in the owner's order.
- `transactions`: season, phase of the league year (offseason, re-signing, free agency, during the draft, after the draft, preseason, regular season, postseason), weekKey for in-season phases, type (sign, resign, release, trade, waiver claim, IR, activate, extension, restructure, retire), players in and out, picks in and out by year and round, counterpart team, contract terms, notes, and the roster and pick changes the move made (so editing or deleting it undoes exactly those).
- `injuries`: season, weekKey, playerId, type, length, IR flag.
- `hofEntries`: playerId or staff name, role, jersey, inducted year, retired number flag, blurb, highlight seasons, career summary cache.

### 4.7 Ingestion

- `uploads`: storage id, mime, width, height, source (shortcut, web, dragdrop), target key or null, season, weekKey, status (`queued`, `extracting`, `review`, `committed`, `rejected`, `failed`), error, createdAt.
- `extractions`: upload id, target key, model used, raw JSON, normalized draft, confidence per field, warnings from validators, token usage, latency.
- `manualDrafts`: entries typed in by hand for any target, edited in the review editors and committed through the same path; never recorded as corrections.
- `corrections`: target key, field path, extracted value, corrected value, image crop reference, used-as-example flag. Feeds few-shot prompts.
- `ingestionTokens`: hashed bearer tokens for the Shortcut. They belong to the owner rather than a franchise: uploads land in the active franchise.

---

### 4.8 Real NFL history (before the franchise)

- Imported once when a franchise is created, refreshable from Settings: for every finished season from 1999 up to `startYear` (1999–2001 in that era's six divisions), all 32 teams' records, standings, playoff results and titles; real players with their careers and season totals up to the franchise start; draft history; and all 32 teams' real rosters for the first season, so box scores resolve to real players from the first game.
- Lands in the same tables as franchise data (`seasons` for the user team, `standings`, `seasonPlayerStats` with `source: "import"`, `players` with `isReal`, `trophyEntries` for pre-franchise titles), so history screens, player pages and records read one model. Pre-franchise seasons are marked as such and never mix with captured game logs.
- Source: the nflverse public data releases (standings, schedules, players, season stats, draft picks, rosters as CSV), chosen in Sprint 4; ESPN supplies headshots and logos. Decision, coverage and mechanics in `docs/NFL-HISTORY.md`. Fetched by Convex actions; never a spreadsheet the user supplies.


### 4.9 Operations

- `backups`: kind (scheduled or manual), storage id of the gzipped JSON, size, rows per table, franchise names, created at.
- `errorReports`: one per distinct client error (fingerprint), kind, message, stack, path, user agent, count, first and last seen. Capped at 100.

## 5. Features by area

### 5.0 Franchise setup

- Shown in place of every screen until a franchise exists (after sign-in).
- Name the franchise, pick the user team from the 32 (grouped by division, in team colors), and choose the first season, defaulting to the current real NFL season.
- Creating it seeds that first season and starts the real NFL history import for the seasons before it (4.8). Works the same on the phone.
- Another franchise is created with the same form from Settings, the franchise switcher or the command palette; it becomes the active franchise with its own history import, and the others keep their data.

### 5.1 Home (dashboard)

- Season header: team logo, record, division standing, streak, point differential, playoff status, and while a season runs what it is on pace for ("On pace for 12-5, 410 points").
- **Countdowns**: the three career marks the roster is nearest, ranked in games away at each player's own rate, with a bar to each. Hidden until someone is within a season of one.
- **Pending prompts** card: pre-season report due (persists until answered, even if dismissed once), post-season report due after the Super Bowl week, and any open offseason needs. Clicking opens the report editor.
- **Season checklist**: what to do and shoot next, opened on the part of the year the season is in, with the rest a tap away. Offseason (rosters carried over, retirements, re-signings, free agency, draft class, roster page), preseason (depth chart, goals, pre-season report), this week (game log, standings, weekly awards) and season end (season stats by category, team stats, final standings, awards, playoffs, post-season report). Each item is worked out from the data and goes to the screen or capture that fills it; nothing is ticked by hand. Under it, a **coverage strip** counts what the season has so far: box scores, team stats and scoring summaries against games played, and standings and weekly awards against the regular season. Reconcile shows the same strip.
- **Goals**: the season's pre-season goals with progress and hits.
- **Next up / last game**: score bug for the most recent result with its stars and a snippet of the notes; opponent card for the upcoming week with head-to-head history and their record.
- **The week**: a one-week recap of the latest result: the score, record and streak, the stars, the records and milestones it raised, and how it moved the team in the division where league scores were captured. It copies as text to paste into a message.
- **This week's milestones**: auto-detected (career highs, 100-yard games, franchise records, streaks) with one-tap acknowledge.
- **Inbox** summary: items waiting for review, with a direct link.
- **Season pulse**: small charts of points for and against by week, and team rank trend in key categories.
- **Recent transactions and injuries**.
- Decade grid teaser from History (franchise record so far).

### 5.2 Schedule

- Week list for the selected season: week, opponent with logo and record at kickoff, home/away, score, result color, overtime tag, every star as a player chip with their stat line, and the notes in full (the row grows to fit).
- A star's stat line is never typed: it is read from the game's box score whenever the star is shown (`shared/games/starLine.ts`), so a corrected box score corrects it and stars picked before lines existed have them. By position: quarterbacks `22/35, 62.9%, 452 yds, 3 TD, 1 INT, 2 ATT, 12 yds, 1 TD` (interceptions and rushing only when there are any); running backs `19 ATT, 123 yds, 2 TD, 1 rec, 4 yds`; receivers and tight ends `4 rec, 121 yds, 1 TD, 1 ATT, 7 yds` (a rushing or receiving TD only when scored); defenders `6 TKLs, 4 TFLs, 1.5 sacks, 1 INT, 1 PDEF, 1 FF, 1 FR, 1 TD` with every zero left out (tackles are combined); kickers, punters and returners get their own. A star with no box score line (a typed name, a lineman) shows none. Byes and playoff rounds shown as their own row types.
- Calendar view: the season laid out by week with game day emphasis; playoff rounds and offseason markers.
- Season-by-season navigation and a season summary strip (W-L, points, streaks).
- Add a game (or a bye) by hand; the user team is always one side. Edit or delete it from game detail; records, stats and standings refresh as after a box score commit.
- **Game detail**, split pane:
  - Top: score bug with the scoring by quarter under it (from the scoring plays when the game has them, and then not typed over; otherwise captured from the game log or typed in; overtime periods add as columns, and the quarters must add up to the final). On a played game, the **scoring summary**: every score by period with team, clock, the play in words (the printed line as a tooltip), the score after it and a tag for an unusual try, the game-winning score named, lead changes and ties counted, and a score worm (the user's margin over game time, tap a score) beside it on desktop and above it on a phone. A play can have its scorer or passer changed with a tap; a play the screen dropped a name from, or the user's own scorer who matched nobody, says it needs a player, and when only one player in the box score can be it, one tap assigns that player. Then team game stats side by side (away team left, home right, like the score bug) with bar comparisons in colors that never clash (the opponent falls back to its other color when both teams' accents look alike), stars of the game (picked by hand, any number, ordered, each with their stat line from the box score and an optional note), and the narrative notes editor on the right.
  - Bottom: full box score on one page, no tabs, by team: every table for the franchise's team first (always on top, whether home or away), then every table for the opponent. Each team's tables run in category order (passing, rushing, receiving, defense, kicking, punting, returns), skipping categories it has no one in; a category's columns match between the two teams. A star beside each player makes him a star of the game in one click (added last in the order) and a second click takes him out; the Stars editor stays for ordering, notes and typed names, and shows each player's line for the game (the same line stars show) on both the picked stars and the players to add. Highlighted performances by registry thresholds (300-yard passer, 100-yard rusher or receiver, 3 TDs, 2 sacks, 2 INTs, perfect passer rating) and career-high markers. Each player's numbers are also highlighted like season stats, on a single-game scale (defaults in `DEFAULT_GAME_TIERS`, each changeable in Settings → Game highlights): passing yards 300 and 500, passing TDs 3 and 5, rushing or receiving yards 100 and 200, rushing or receiving TDs 2 and 3, catches 8 and 12, tackles 10 and 15, TFLs 2 and 4, sacks and interceptions 2 and 3, a forced fumble or defensive TD 1 and 2, a 50- or 55-yard field goal. The same marks show in each player's game log; team totals stay plain.
  - "Import screenshot" affordance on every game that opens the inbox pre-tagged with that game, and can attach screenshots already waiting in the inbox.
  - The box score, team stats and every player game log edit inline (Edit); player lines can be added and removed by hand.
- Head-to-head panel: all-time record vs this opponent inside the franchise, with links to each game.

### 5.3 Roster

- Current roster for the selected season as one table per position group (quarterbacks, running backs, ... long snappers), one after another with jump links to each group: position, number, headshot, name, age, OVR, exp, college, acquisition, contract, dev trait, grade note. Each position family has its own color (the line, edges, linebackers and safeties share). Sortable, column visibility remembered.
- Acquired reads as the draft slot ("Rd 1, Pick 1 · 2027") for a player the franchise's team drafted, unless his entry records a later way back (a trade, a free agent signing, a waiver claim); everyone else shows how the entry says he arrived.
- Any team's roster opens from the team switcher, your own by default (and from a link, `/roster?team=MIA`). A team with no roster page is labeled partial: it holds only who box scores, awards, league leaders and draft imports have named.
- Rosters carry into the next season: starting a season copies every team's roster from the one before (released and traded-away players stay behind, IR ends, age and experience go up a year, every contract loses a year, everything else as it was), and offseason moves are recorded on top. A player who already has an entry in the new season is skipped, so repeating it adds only who is missing. An empty roster in a season after the first offers "Bring over the <year> roster" for seasons started before this.
- A user-team contract that runs out at carry-over leaves the player on the roster as **Contract expired**, off the cap, with a prompt to re-sign or release each one as a logged move. Another team's expired deal is simply dropped. Another team carries only players a commit has named in the last two seasons, so rosters assembled from screens do not fill with people long gone; the user team is never pruned.
- **Roster page truth**: a committed roster page stands as the team's roster for the season. Anyone it lists is on that team, back from a release if need be, and off any other team that season. On a whole page, anyone it leaves off is released as of its week; the practice squad stays, since Madden lists it apart. A page under 40 rows, or one marked "Only part of the roster" in review, releases nobody. Review names who would go before commit, and afterwards the Roster shows what changed until the owner keeps it or puts people back.
- **Retirements**: at the start of each season after the first, players at retirement age (34; 38 for quarterbacks, kickers, punters and long snappers) whom nothing has named this season are suggested on one list, opened from the season checklist. Pick some, everyone or nobody; each retirement is a logged move that takes the player off the team, and deleting it undoes that. A retire row on a captured transactions screen does the same.
- Released and traded-away players leave the roster page as soon as the move is made; their seasons and moves stay on their own page and in Transactions. The header counts the players on the roster.
- Averages of OVR, age and experience for the team and each side (released and traded players left out).
- Every column edits inline (Edit); "Add player" creates a player on a roster. Each row's actions menu moves him (team or status for a season, without logging a transaction) or records a trade, other move or injury for him (5.10).
- Batch moves: a pick box after the actions on every row, select all, and a bar that stays pinned while anything is picked; Release records a release per picked player in one sheet (one timing, one note), Trade opens the trade builder with every pick on the user team's side.
- Depth chart view by position with OVR badges. A roster page sets the order from how it lists each position; arrows on each row fix it by hand.
- Roster diff between the season shown and any other: arrivals, departures and OVR changes, always read earlier to later.
- Contract and cap view: cap hits per player, total, expiring contracts, with a "needs" link to the season report. It projects next season from the contracts that continue (committed, what comes off, space against next season's cap once set, else this one) and lists the contract year: each expiring deal is re-signed as a logged move, or let go once the season is over. Starting the next season says how many deals run out first.

### 5.4 Players

- Player page: hero with the player card (headshot or monogram) in team colors, position, number, age, height and weight, college, draft slot, acquisition story, contract, dev trait and abilities (per season, on the roster entry), notes; OVR progression chart across seasons and in-season checkpoints.
- Career stats table by season with totals row, computed from game logs (real NFL seasons before the franchise are imported totals, marked), with the elite highlight rules applied per season. Postseason split toggle.
- Game log for any season or the whole career with per-game highlight markers, and a badge on the game that reached a mark. A career can be narrowed to the games with at least so much of a stat, every 100-yard game say. The box score lists the marks its game reached too.
- Splits: his games with the team by season phase, home and away, result, kind of opponent, margin, overtime and each team met, for a season or the career, in the columns of a season row. Regular season unless the group says playoffs.
- Awards, every records list he makes (rank in the team, franchise-era and all-time books and the best spans; one that falls out of the top 20 goes), streaks at their longest with their dates (an ended streak stays), draft info, transactions involving the player, Hall of Fame status.
- Milestones, newest first, each linked to its game: marks reached with the games they took and where that stands on the fastest-to list, career highs, threshold games, records and streaks.
- Compare: two to four players side by side on shared stat keys with a radar or bar chart.
- Edit every player fact (names, position, birth year, college, size, draft, retired) and every season's roster entry inline, team included; the Move menu moves the player or records a trade, signing, other move or injury for him (5.10).
- Pace, during a live season: each main stat against last season, the career best, the next mark and the franchise record, with the projected finish and the rate needed.
- Trends: any stat that adds up, season by season, with age, games and the change from the year before; a short season shows its change without a verdict. Imported seasons are marked.
- Cumulative: each season's running total from game 1 against the last season, the best season and the franchise record's pace, with marks ruled across the chart, and a rolling five-game average. Franchise games only.
- Provenance: every player records how they arrived and the season they first appeared. Imported players and ESPN matches are real; anyone else who first appears in the franchise's first season came off a real roster, and anyone later is a created player, fictional until matched on ESPN. The owner can override it from the player page, and the roster's face matching lists only players who may have a real face. Settings → Player identity tidies players from before this was kept.
- Names: a name splits properly however it was printed ("M.Hawkins" is M. Hawkins, with the printing kept as an alias), aliases are searchable everywhere a name is, and a fuller source that commits to a one-initial player gives them their full name, keeping the old one as an alias.
- Identity tools: merge duplicates (suggested on the player page when one is likely, and across every captured player in Settings), a "seen in" list of how a player arrived, their seasons and games and how screens printed their name, rename with the old name kept as an alias, edit aliases, mark a player fictional, and apply a name corrected in review on any screen to every player still carrying the misread name.
- Headshots: imported real players arrive with their ESPN id; anyone else is matched on ESPN by name (NFL first, then college football for created players in a real draft class, ranked by school and position) and confirmed by the user, from the player page or in bulk from the roster. Photos are cached in storage. Fictional players get a generated monogram card in team colors. Manual upload supported (later).
- Players index: every player on a team's roster during the franchise (any team), filtered by position and sorted by OVR, age or seasons with the team, plus a name search across every player, real history included. Each row's actions menu records a trade, signing, other move or injury for him (5.10). Picked rows (select all included) compare (two to four), sign to the user team (players not on it now), release (players on it now; one move each) or go into one trade, each on his team's side.

### 5.5 Stats

- Overview, where Stats opens: the record and its pace, point differential, expected wins from the points, points a game, the season's passing, scrimmage and tackle leaders, countdowns, streaks running now, what the season set, and league ranks. Each tile opens the view behind it.
- Trends: the team (results and points by season, any team stat by season with each change, a points race) or anyone on the roster (below).
- Season stats by position group (QB, RB, WR/TE, OL snaps if captured, DL, LB, DB, K, P, returners) for the selected season, every group's table on one page (no tabs), with jump links to each group and one player search that narrows every table, with the registry-driven columns, per-game averages, big-game counts that always show (QB: 300+, 3+ TD, 158.3s, 100+ rush; RB: 100+ rush, 100+ rec, 5+ rec, 2+ TD; WR/TE: 100+ rec, 5+ rec, 100+ rush, 2+ TD; DL, LB, DB: 2+ sacks, 2+ INT), and a season high per stat with a week link to that game. Single-game rates need volume (10 pass attempts, 5 carries, 3 catches, ...). Totals row.
- Fantasy points with ESPN's default PPR scoring (`shared/stats/fantasy.ts`) are in every stat table: season, league, career, game log, box score and compare. A player's main stats lead his tables (a QB's passing, a back's rushing, a receiver's or tight end's receiving, then his other categories) and fantasy points come right after them; for every other position they come last (`categoriesForPosition`). A box score table is one category, so fantasy follows it there. Defenders score only on return touchdowns, as in ESPN's default league.
- League stats: every player's regular-season totals across the league by position group, every group's table on one page with jump links and one search (a player's name or a team's abbreviation), filterable to our team or the rest of the league. Our players come from the game logs (with games settled as missing on the reconcile screen); everyone else from captured season stats screens (the season stats target, for any team or the league view), never from the partial lines in our box scores.
- League team stats: every team's season, as totals or per game. An overview (points scored and allowed per game, point and yard differentials, turnover margin, third down and red zone rates), then one Madden tab at a time: Offense (total, offensive, passing and rushing yards, points per game, passing and rushing TDs, first downs, plus points scored, offensive TDs and return yards), Defense (yards, passing and rushing yards and points allowed, points allowed per game, sacks, fumble recoveries, interceptions), Conversions (third down, fourth down and two-point made, tried and rate), Red zone (trips, touchdowns, field goals, touchdown and scoring rates, for and against), Turnovers (margin, giveaways, interceptions thrown, fumbles lost, takeaways, interceptions, fumble recoveries). Captured from the NFL team stats screen, any tabs in one set, or typed in. Per game divides by the team's games from the standings, else the user team's, else 17; percentages and per-game figures stay as they are. Points scored is points per game times games, so it is off by a point or two where Madden rounded the average.
- Editing any player's stats: Edit on the player page's career table, the season stats table and League stats turns recorded stats and games played into inputs (rates and averages are worked out from them). Imported real-NFL seasons and captured season lines change in place, the career following. A log-derived regular season keeps its logs: the typed number is stored as the season screen's and shown in their place, marked like a missing game, and clearing it goes back to the logs; playoff totals change through their games. The player page lists a captured season that has no season row, so another team's player has his line there too.
- Season stats can show each player's pace while a season runs (projected over the team's games left, so a missed game stays missed) or the change from last year on every stat that adds up. Neither is a stored number, so neither edits.
- Player goals for the season with progress and a goal-hit marker. Leaders, team stats and season totals can be typed in.
- Elite highlighting: configurable thresholds (defaults: 100+ catches, 1000 and 1500 yards, 10+ TDs, 5000+ passing yards, 40+ passing TDs, 70%+ completion, 10+ sacks, 5+ INTs, 100+ tackles). Two tiers of highlight.
- League leaders, under League → Top 20s: Madden's top 20 per stat for the season as captured, by category, with the user's players marked and a "where we rank" summary: spots held, how many are in the top 5, how many lead the league, and each stat's best placing.
- Team stats: all team categories per season with value, rank, trend across seasons, and league context, visualized as rank ribbons rather than strings. Values land from each game's team stats the way player season totals land from game logs: points per game from the scores, offense from the user side of each game's team stats, what the defense allowed (and its sacks and takeaways) from the opponent side, per-game figures averaged over the games that have them, regular season only. A value captured from the team stats season screen, or typed in through its manual entry, replaces the derived one; league ranks only come from captures. A note under the ribbons says how many stats came from games and how many were captured.
- Records books, each by single game, season and career, top 20 per stat with player, number, team and year (a career's span). A single-game list holds each player's three best games a season, each linked to its box score:
  - **Team**: every season with the user team, real seasons before the franchise included, so legacy players hold records.
  - **Franchise era**: only what happened since the franchise began, with the game link and the previous holder. Broken records surface on the dashboard the week they fall.
  - **All-time**: every team: real seasons from 1999 (nflverse), every captured game and Madden's league leaders screens.
  - Typed numbers (Bruce Smith, 200 career sacks) join the team and all-time books, replacing the computed entry for the same player; only the number, never the games. A whole list (a records page from any website or book) comes in as screenshots or a CSV through the records list target, one typed record per row with player, team, season and number.
- Fastest to: per stat, one list per mark of the fewest games to reach it, over a career, a single season or a stint with the team, each with the game that reached it. Regular-season games with the team; a real veteran's imported seasons count as a starting total and a game count.
- Best spans: per stat, one list per window (any 2, 3, 4, 5, 8 or 10 games), each with its two ends, across seasons too. A game a player missed neither counts nor breaks a span.
- Team records: most and fewest points, biggest win and worst loss, yards, sacks, takeaways, first downs, best differential and most wins, plus the best quarter, largest comeback and largest lead lost, by single game and season. Franchise games only; a game with no team stats captured stays off the lists that need them.
- Scoring records, under the books, from captured scoring summaries (franchise games only): the longest score of each kind, most touchdowns in a quarter, game-winning scores and connections by season and career. Regular season and playoffs apart.
- All-time leaders: career top 20 per stat within the franchise era.
- Streaks: team (wins, home, road and division wins, one-score wins, games scoring 30, games allowing under 20, games with a takeaway), seasons (winning seasons, playoff appearances, division titles, double-digit win seasons) and player (consecutive 100-yard rushing, receiving and scrimmage games, games with a TD, a TD pass, a catch, a receiving TD, a sack, a sack or TFL, a takeaway, a field goal, games without an interception, games played). Each keeps where it began and where it ended. Stats → Streaks lists what is running now (three or more, for the team and anyone on the roster, with its start) and the longest of each kind, of all time or within one season.
- Team splits, under Team, for the season or all seasons: the same groups as a player's, each with games, record, points, differential and yards a game where team stats were captured. Points by quarter for and against with the difference, overtime as extra columns, and the difference by half.
- Explorer: build a question from a stat, a scope (game, season, career, any N games, fastest to a mark), a split, a position, a range of seasons, minimum games and optionally one player, and read the answer as a list or as bars. The question lives in the URL (`/stats/explorer`), so it can be bookmarked or sent with Copy link; on a phone the controls open in a sheet behind a line saying what is being asked. An answer comes from a board or the season rows where they hold it, and otherwise from game lines, which covers at most five seasons or one player's career; a wider question is refused and says what to narrow, never approximated. It counts franchise games with the team, regular season unless the split says playoffs.
- Lists built from game logs (the records books, fastest to, best spans, streaks) say how many played games have no box score, and which, with a link to Reconcile.

### 5.6 League

- One season page with standings, then scores, then the playoffs; champions, the all-time table and rivals are their own views.
- Standings by division or by conference (seed order), no point differential (1999–2001 in that era's six divisions). Bye seeds read green and wild cards orange, projected with NFL-style tiebreakers (head-to-head, division, common games, conference, strength of victory and schedule) until every team has played its regular season; seeds printed on a standings screen or imported win then. Clinch marks by arithmetic alone, never wrong and sometimes a week late: z a first-round bye, y the division, x a playoff spot (one mark, the highest).
- Scores: every game of a week across the league, from the schedule screen (one week or several at once) or typed in; a season's whole schedule can be loaded from the real NFL schedule before kickoff (Madden's first season plays it). Opens on the latest week with a score.
- Bracket: always filled, from the projected seeds (marked Projected) until the regular season is over, then the real field, decided game by game as playoff scores arrive.
- Any team's history inside the franchise: record by season, playoff results, titles, their players we have seen, draft picks.
- Cumulative league table across the franchise: wins, playoff record, division titles, conference titles, Super Bowls.
- Rivals: the user team's head-to-head line against every opponent met (record, playoff record, point differential, streak, margins, last meeting); a team's page charts the margin of every meeting.
- Rivalry page per opponent: the all-time line, what stands out (biggest win, worst loss, most scored and allowed, longest runs each way), our best against them per stat with the best single game, the playoff meetings, and every meeting.

### 5.7 History

- Franchise history home: decade grids (year, W, L, T, division rank, seed and playoff result, coach, note) generated from `seasons`, the latest decade first. Totals per decade and all time. A division title, the 1 seed and a Super Bowl win are marked like elite stats (`Highlight`), and a champion's result names its Super Bowl ("Won Super Bowl LI" for the 2016 season: games are numbered by the season they close, Super Bowl 50 keeps its number and seasons before 1966 won the NFL title).
- Every saved season edits from its pencil (a sheet on desktop and phone): a real season before the franchise edits everything; a franchise season keeps the record its games give and edits its division finish, seed, playoff result, coach and note. Seasons older than the nflverse import (1999) come from the **Team history** target: a screenshot of the team's year-by-year table, a CSV, or typed in, for the user team only and only before the franchise's first season.
- Trophy room: Super Bowl wins (largest, each a banner with the game's numeral over the season's year), division titles (pennants), then conference titles and playoff appearances, with years; franchise titles glow in the team accent and real history sits in the softer wash, real pre-franchise history from the external import (4.8) and editable entries, so the team's real history sits alongside franchise results.
- Pre-season goals on the season report: team goals (wins, division, playoffs, bye, playoff win, Super Bowl trip or title, write-in) and player goals (a stat target or a write-in), judged from the season as it is played, markable by hand.
- Season reports archive: for each season, pre-season thoughts, post-season thoughts, around the league, needs with resolution status, and the computed season summary next to them.
- Season recap: a page per franchise season told from what was captured: the record and finish, the margin of every week with the best and worst of them, the stars and their awards, records set, moves, the draft class and the report's own words. Generated on read, so a late capture or a correction shows up, and opened from the report and from Home once the season is over.
- Hall of Fame: wall of hanging jerseys in team colors with number, name, position, years, induction year, retired-number flag and a blurb; click to the player page. Add from any player page; coaches and staff are added from the wall. Retired numbers sit above the wall, and retired players still in the team's career records are listed below it as candidates. Those five seasons out of the game are listed apart as eligible, the new class marked. The induction sheet argues the case: seasons and games with the team, honors, the team's record lists and the career marks reached.
- Narrative timeline: every note across games, seasons, transactions and awards in one scrollable story, filterable by season and type.

### 5.8 Awards

- Weekly: AFC and NFC offensive, defensive and special teams players of the week, rookie of the week, with player, team and stat line, each week's AFC and NFC under their own conference marks. User-team winners highlighted. Imported per week, or a whole season at once (5.11).
- Layout: MVP, Coach of the Year and Super Bowl MVP are league awards, shown large and apart from the conference awards (players of the year, rookies, comeback, best at each position), which sit in an AFC and an NFC column. Only awards with a winner show; the rest wait under "Not awarded yet", where each can be assigned. Weeks and weekly awards not captured wait the same way under "Weeks not captured yet".
- Coach of the Year goes to a coach, not a player: one of every NFL head coach since 2015 (`shared/domain/coaches.ts`, interim coaches included) or a coach created in the franchise, like create-a-player. A coach name the bank does not know, typed when assigning or read off the awards screen, is created as it is used.
- Yearly: MVP, OPOY, DPOY, OROY, DROY, CPOY, Coach of the Year, Super Bowl MVP, best player per position (K, P, KR, QB, RB, WR, TE, OL, DL, LB, DB), All-Pro teams, Pro Bowl rosters, and custom additional awards. Imported from the awards screens.
- Counted from the stats, live: Fantasy Player of the Year (most fantasy points), Sack Leader, Ball Hawk (most interceptions), Heat Seeker (most tackles, solo plus assisted), and the most offensive and defensive players of the week. Leaders come from league stats and the weekly awards; ties share the award.
- **Race**: during the season, the top five for MVP, OPOY, DPOY and OROY, and the user's best wherever it stands, each with what they trail the leader by. Offense is ranked on fantasy points, as the counted award is; OPOY leaves out quarterbacks; OROY takes players drafted that year; defense is ranked on points that weigh sacks and takeaways. Lines come from league stats, plus anyone only the league leaders screens name, marked as partial. It never sets a winner.
- Every yearly and counted award can be assigned by hand from the awards screen (a league leader or any player), replacing the import or the count; clearing it goes back to the count.
- Team awards defined by the user (team MVP, rookie of the year) chosen from the roster.
- Awards cabinet per player and per season.

### 5.9 Draft

- Draft history from the franchise start: per season, every user pick with round, overall, position, player, OVR at draft, college, note, trade origin. Each pick card is tinted in the player's position color and shows his position, OVR and dev trait that season (hidden, normal, star, superstar, X-Factor) from his roster entry, falling back to the OVR at the draft.
- Draft class retrospective: computed hit rating from OVR progression, starts and awards, shown as a grade after two seasons.
- Pick inventory: future picks owned and owed, how acquired.
- Draft board (lightweight): pre-draft needs from the season report, prospects the user noted (in their own order, `draftBoard`), who they took.
- League-wide first round import when available, so other teams' rookies get player entities.

### 5.10 Transactions and injuries

- Transaction log per season with type filters, contract terms, trade detail, and the player chips, ordered by phase and week. Resign and extension tracked with cap effect.
- Record trades (two teams, players and picks by year and round, a note), free agent signings and every other move by hand, with when it happened (phase and week). Rosters and pick ownership follow; editing or deleting undoes exactly what the move changed, and a captured transactions screen moves rosters the same way. Injuries are logged, edited and deleted by hand too.
- The same sheets open from wherever a player is: a roster row, a players index row and the player page start the trade, signing, other move or injury with him already in it (a trade puts him on his team's side).
- Injury report per season with length and IR flag, shown on the roster and the player page.
- Trade tracker: each trade with assets in and out and a retrospective note.

### 5.11 Ingestion

- **Inbox**: grid of uploads with thumbnails, target tag, season and week, status and age. Batch select. Keyboard driven.
- **Capture paths**: Apple Shortcut (share sheet or home screen: pick photos, choose target from a menu generated from the registry, optional week, POST with bearer token), web upload on the phone, drag and drop or paste onto the Mac app, and "Import screenshot" buttons on game, season, awards and draft screens that pre-fill the target and context. Every path stores a JPEG with a long edge of at most 2048 px (the web app re-encodes in the browser, the Shortcut resizes and converts before posting) and the backend refuses anything over 2 MB, because stored screenshots are read again by the model and the app and Convex bills that as egress.
- **Extraction**: Convex action per upload. Chooses the prompt and JSON schema from the target registry, attaches recent corrections as few-shot examples, calls OpenRouter with a primary vision model and a fallback, validates the JSON (completions ≤ attempts, yards consistent with per-game lines, names resolved to roster), and stores a draft with per-field confidence and warnings. A box score's screenshots are sent a few per request (at most 3 and about 20 MB, under providers' image caps) and the answers merged before normalizing, so review sees one draft. A run can be stopped or restarted from the inbox or review at any time (a superseded run's answer is dropped), gives up with a clear error before Convex's 10-minute action limit, and a watchdog fails any run that never reports back, so a set is never stuck reading.
- **Review**: side-by-side image and editable draft. Low-confidence and warned fields are highlighted. Player names resolve to roster chips with a picker for ambiguous matches. A game screen looks first at the user's team and the week's scheduled opponent, active players ahead of anyone released or traded away, then at every player who has not retired. The picker also offers that team's known players at the position, so a name is one tap away. Assignments are remembered per franchise, season and team, including choices saved before commit, and last season's choice for a team carries forward unless the player has left it. A game never creates a player unseen: every name that is ambiguous or new has to be picked or marked Create as new (one at a time, or every unknown name at once) before it commits, and an accepted row with an unsettled name waits the same way. Numeric recommendations have an Apply button; doubtful values can be approved, and player suggestions assigned or changed directly from Check first. One keystroke to commit, reject, or re-run with a different model. Duplicate detection if the same game or week already has data.
- **Commit**: writes canonical rows, recomputes the affected season and career aggregates, records, streaks and milestones, and stores any corrections.
- **Targets (v1)**: full game log (the default: team stats, player stats and the scoring summary screenshots in one upload, review and commit), game result and box score, team game stats, and the scoring summary. Total yards is always passing plus rushing, excluding Madden's return-inclusive total. Team game stats are keyed by a team stat registry (`shared/stats/teamRegistry.ts`) the way player stats are keyed by the stat registry. **Targets (v2)**: season player stats per position group, league leaders top 20, records lists from any source (player, team, season, number), team history (the user team's seasons before the franchise from any source), team season stats, standings, weekly awards, yearly awards, draft results, roster page, transactions, injury report, player card.
- Every target has a scope: one game, one week or the season. A game-scoped list needs a game on the schedule to file under. A set extracts once it has the context its scope needs; capture paths infer the season and week when they are not picked.
- Multi-image targets: a box score split across screenshots is grouped into one upload set and read together; a list (standings, leaders, a roster, the draft) is read a screenshot at a time and merged as the union of its rows. List rows are reviewed as cards and accepted one by one, or all at once with Select all (Deselect all clears them to pick a few); only accepted rows commit. Any list can also take its rows from a CSV file whose header names the columns (player, team, then the list's own fields by name or label, such as season or rank).
- **Season stats of any team**: a season stats screen names each row's team, or the team the screen is filtered to (Team shown); a row with neither cannot commit. Other teams' rows land in Stats → League → Players and never on the user's roster.
- **Where it goes**: every screen type in the capture, tag and manual-entry pickers says where its data shows up (Weekly awards: Awards → Weekly; Full game log: Schedule → the game).
- **Reconciliation**: season totals from a season stats screenshot are checked against the totals derived from game logs (never replacing them). Each difference is settled by accepting the log number or flagging a missing game, one at a time or any picked set at once (Select all, then Use log numbers or Missing games; settled ones reopen the same way), with the weeks that lack a box score listed. Where a difference is flagged as a missing game, the season stats screen and the player's career table show the screenshot's number instead, marked with a dot; the stored log totals, records, leaders and career aggregates keep the log number.
- **Schedule / scores** target: the week's league schedule screen into `leagueGames`. Several weeks' screens can go up as one set (each row filed under its screen's week), so a whole season's schedule loads at once. The user team's game in each week lands on its Schedule; a regular-season week of 13 to 15 games without the user team records its bye (a full 16-game week has no byes, and fewer games are too partial to say), and a game captured for that week later replaces the bye.
- **Weekly awards batch** (Inbox → Weekly awards, also from Awards): the season's players-of-the-week screens uploaded together, each its own set. Each is matched to its week afterwards (by hand, or filled in upload order skipping weeks already captured), the batch is read together, and every screen read cleanly (all rows accepted, nothing to check) commits in one go; the rest open in the usual review. A strip of the 18 weeks shows which have awards, which have a screen waiting and which have nothing.
- **Scoring summary**: Madden's list of every score in a game, over one or two screens, filed under a game, on its own or as part of a full game log. Each row reads the quarter, clock, team, kind of play, yards, passer, try and the score after it. Review checks each play is worth what its kind says, the running score, the game's final and both teams' touchdowns against the box score; the first three block a commit, the box score only warns. The screen sometimes drops a player's name: the row still commits, and review and the game page offer the box score's unclaimed scorers, ranked by the kind of play, with one tap when there is only one. A name never creates a new player here. Committing replaces the game's plays, fills in the quarter scores, and gives a game with no final its score. In a full game log the plays are reviewed in their own Scoring plays section and checked against that log's own final and box score; a printed name reaches a player that log's box score adds, and an upload with no scoring screen, or with every play left out, leaves the game's plays as they are.
- **Draft results**: a team's drafted-players screen (NAME, POS, ROUND, PICK, OVR, with the highlighted pick's full name, age and college above the list) or any similar list. Each row reads the round, the pick within the round, position, OVR, age and college; the overall pick is never typed but worked out (Madden drafts are 7 rounds of 32 with no compensatory picks, 224 in all, `shared/draft/slot.ts`). The list shortens names ("M.Hawkins"); a screenshot with that pick highlighted gives the full name, which wins when the screenshots merge. Draft rows are not matched to the rosters, since a draft class is mostly created players, but they are matched to the slot's committed pick and to players created that season, who must agree on name and on college or position; anyone else starts as a new player, and the review picker searches the franchise and college football on ESPN (name, position and school shown side by side) or takes a typed name for the new player. A class can be committed again: each slot keeps its player, so nobody is created twice. The age column anchors a new player's age. A pick matched to a college prospect keeps the ESPN id, so the photo follows them.
- **Player picker**: a fixed-height sheet that only its handle drags closed; results stay on screen while the next search loads, so the list does not jump or empty while typing.
- New players: a player a committed screen names who is not in the database is added to it, roster entry included when the row names a team. Rows without a team (an award winner, a leader) still add the player, without an entry. The scoring summary is the exception.
- **Enter manually**: every target has a typed-in counterpart in the same review editors (from the Inbox, Awards, Draft and Stats), saved as you go and committed through the same path.
- Cost and latency panel in Settings with per-model usage, and a monthly budget: a banner on every screen from 80 percent, and at the limit new screenshots wait in the inbox instead of being read. They start by themselves once there is room: a higher budget, or the new month, at the nightly look.
- The same screenshot twice: a file already in the inbox (by its hash) is stored but not read, and waits marked "Already uploaded" to be read anyway or deleted, so a repeat costs nothing. One rejected or failed earlier goes straight through.

### 5.12 Settings

- Franchises: every franchise with its team and current season, switching the active one, and "New franchise".
- Franchise: team, start year, season length, playoff format.
- Thresholds: edit elite highlight thresholds per stat, two tiers each, on two scales: Highlights (season numbers in every table) and, right under it, Game highlights (one player's numbers in a single game, in box scores and game logs). Only changed stats are saved; Restore defaults clears a scale's overrides.
- Models: OpenRouter primary and fallback model, temperature, token budget. Both are picked from saved model presets (the defaults plus any the user adds; saving a new model adds it), with an "Other model" field for any id. The re-run sheet uses the same presets.
- Shortcut: generate and revoke tokens, download the Shortcut file, test endpoint.
- Data: refresh the real NFL history import; back up every franchise now (and nightly, keeping fourteen) as gzipped JSON to download; restore a listed backup or a file as new, inactive franchises (never overwriting); export the active franchise's games and player seasons as CSV. A restored franchise rebuilds its records, marks and boards by itself. Backups leave out inbox screenshots and Shortcut tokens (docs/LAUNCH.md).
- Maintenance: every job that used to need a terminal, for the active franchise, each with its last run: rebuild stats, recount team totals, clear typed star lines, move misfiled season stats, clear old screenshots, and fix a misread name. Jobs that change data show what they would do first. How long finished screenshots are kept (90 days, 180 days by default, a year or forever) is set here; the nightly tidy deletes the ones past it, with their reads, and what they committed stays. Rejected screenshots go after 30 days at most.
- Franchises: delete any franchise, the active one included, after an "are you sure" and typing its name; the franchise used before it takes over (or setup when none is left), and its rows go in the background.
- Real NFL history: add 1999–2001 to a franchise imported from 2002.
- Errors: unexpected errors from any device, and scheduled jobs that failed (by function name), one row per distinct error with a count. Marking them seen leaves only what happens again showing as new.
- Appearance: team color intensity, density, reduced motion.

### 5.13 Mobile parity

Every feature in 5.1 through 5.12 ships on the phone with the same data, filters, sorting, editing, review and commit capabilities. Nothing is desktop-only. Specific behaviors:

- **Navigation**: bottom tab bar, "More" sheet, page headers with back navigation (Back returns to the screen you came from, scroll position included; a page opened directly falls back to its parent screen) and the season switcher, swipe between weeks on Schedule and between seasons on History.
- **Tables**: `DataTable` has a phone layout mode (section 9) so stat tables stay complete and readable without horizontal panning across twenty columns.
- **Split panes** (game detail, review, compare) become stacked segments or swipeable pages with a segmented control.
- **Editing**: notes editors, needs checklist, roster grade notes, season reports and Hall of Fame induction all work with the on-screen keyboard; autosave on blur.
- **Ingestion**: capture from the camera or photo library directly into the inbox, tag and set context on the phone, run extraction, and review and commit on the phone. The review screen shows the image and the draft as two swipeable panes with the image zoomable; low-confidence fields are listed first so a review can be finished with thumbs.
- **Charts**: all charts render at phone width with touch tooltips and a reduced tick density; sparklines and rank ribbons are preferred in lists.
- **Dashboard**: the same cards, stacked in one column, with the prompts card and inbox summary first.
- **Offline**: recently viewed screens readable offline (every query result a screen showed is kept on the device and served only while offline, with a banner); captures queue locally and upload when back online, one flush at a time, retried when the app comes back to the foreground.
- **Install**: PWA manifest, home-screen icon, splash, standalone display, safe-area insets, and the Shortcut download from Settings.

### 5.14 Search and keyboard

- `⌘K` command palette: players, games (by week or opponent), seasons, screens, and actions (new upload, open report). On the phone the same palette opens from the search icon.
- Shortcuts: `[` `]` for previous and next week, `S` to switch season, `I` for the inbox, `?` for the shortcut sheet. On the phone the equivalents are swipe gestures and the floating capture button.

---

## 6. Structured data rules

| Instead of | The app stores |
|---|---|
| Three stars as free text with stats inside | Ordered `stars[]` of player ids on the game, with the stat line rendered from the box score |
| Season totals typed by hand with "highest game" columns | Derived from `gameStatLines`; best-game columns computed |
| Team stats as "27.3 - T-3rd" strings | `teamSeasonStats` with value, rank, tie flag, attempts |
| Opponent record inside the team name | `opponentRecordAtKickoff` field |
| Acquisition as "D 2024" or "Signed '25 off" | Typed acquisition (type, year, phase, detail) |
| A roster copied per season | One `players` row, one `rosterEntries` row per season |
| Decade grids maintained by hand | Generated from `seasons` |
| Hall of Fame as a grid of names and jerseys | `hofEntries` linked to players with a jersey wall UI |
| Award winners as names with stat strings | Player links where known, raw name fallback, structured stat line |
| Draft notes with no retrospective | Draft grades computed from OVR progression and awards |
| Standings as a running cumulative table | Per-season `standings` plus a computed cumulative table |
| Needs for next year as a sentence | `needs[]` checklist with priority and resolution tracking into the offseason |
| Coaching changes buried in notes | Staff and scheme fields on the season |
| No contract or cap tracking | Contract on roster entries, cap view, expiring list |
| Only the user team's stats | Both teams' lines captured from the box score |
| Notes and numbers in the same field | Separate structured fields plus a notes field |

---|---|
| Three stars as free text with stats inside | Ordered `stars[]` of player ids on the game, with the stat line rendered from the box score |
| Season totals typed by hand with "highest game" columns | Derived from `gameStatLines`; best-game columns computed |
| Team stats as "27.3 - T-3rd" strings | `teamSeasonStats` with value, rank, tie flag, attempts |
| Opponent record inside the team name | `opponentRecordAtKickoff` field |
| Acquisition as "D 2024" or "Signed '25 off" | Typed acquisition (type, year, phase, detail) |
| Roster duplicated per season sheet | One `players` row, one `rosterEntries` row per season |
| Decade grids maintained manually | Generated from `seasons` |
| HoF as a grid of names and jerseys | `hofEntries` linked to players with a jersey wall UI |
| Awards winners as names with stat strings | Player links where known, raw name fallback, structured stat line |
| Draft notes, no retrospective | Draft grades computed from OVR progression and awards |
| Hidden Transactions and Records tabs from another franchise | Real `transactions`, `injuries`, and computed `records` for this franchise |
| Standings as a cumulative formula sheet | Per-season `standings` plus a computed cumulative table |
| Needs for next year as a sentence | `needs[]` checklist with priority and resolution tracking into the offseason |
| Coaching changes buried in notes | Staff and scheme fields on the season |
| No contract or cap tracking | Contract on roster entries, cap view, expiring list |
| No per-game stats for the opponent | Both teams' lines captured from the box score |
| Notes and numbers in the same cell everywhere | Separate structured fields plus a notes field |

---

## 7. Design system

- **Mood**: broadcast scorebug meets Football Manager data density. Dark by default with a light theme that is tested, not an afterthought.
- **Color**: neutral slate base; the franchise team's primary and secondary colors drive accents, sidebar, chart series and highlight tiers. Opponents render in their own colors in score bugs and head-to-head views. Semantic colors for win, loss, tie, overtime, elite tier 1, elite tier 2, warning, low confidence.
- **Type**: Inter or Geist for UI, a condensed display face for score bugs and headers, tabular numerals everywhere numbers align.
- **Tables**: one `DataTable` built on TanStack Table with sticky headers, column groups, pinned first column, density toggle, sort indicators, row hover with inline actions, virtualization for long lists, and a `StatCell` that applies registry formatting and highlights.
- **Charts**: Recharts with a shared theme. Sparklines in tables, rank ribbons for team stats, OVR progression lines, radar for comparisons. Never a chart for a single number.
- **Motion**: 150 to 250 ms eases on hover and reveal, number count-ups on score bugs, no motion on tables.
- **Components are the vocabulary**: PlayerChip, TeamChip, ScoreBug, RankBadge, Highlight, Sparkline, Section, SplitPane, EmptyState. New screens compose these before adding anything new.
- **Responsive by construction**: every primitive owns its phone behavior. A screen never branches on viewport; its components do. Breakpoints: phone under 640 px, tablet 640 to 1024 px, desktop above. Touch targets are 44 px minimum on touch devices.

---

## 9. Mobile legibility system

Dense football data has to be as readable on a phone as on a 27 inch display. These are the component-level rules that make section 5.13 true.

- **`DataTable` phone mode.** Each table declares a `primaryColumns` set (typically identity plus the three to five stats that define the view) and a `secondaryColumns` set. On phones the primary columns render as a compact table with the identity column pinned left and the stats scrolling horizontally within a bounded strip with a visible fade; every row expands with a tap into a card listing every secondary column as label and value pairs, two per row, with the same highlight styling. A column picker lets the user promote any column to primary and the choice is remembered per table. Sorting and filtering live in a toolbar sheet. Nothing is dropped.
- **Stat cards over wide rows** where the data is per-entity rather than comparative: the player's season row on their own page, a team game stat line, a single award. Cards group stats by category with tabular numerals and inline sparklines.
- **Rank ribbons** replace rank columns on phones for team stats: a horizontal bar with the rank and the value, colored by tier.
- **Score bugs** are built at phone width first and scale up.
- **Typography** uses 15 px minimum body on phones, 13 px minimum for table numerals with tabular figures, and condensed display type for headers to preserve width.
- **Sticky context**: page header with season and week stays visible while scrolling long tables; section jump links on long pages (player page, season stats).
- **Gestures**: swipe to change week or season where the header shows a sequence, pull to refresh is unnecessary (reactive data) and disabled to avoid accidental triggers, long press on a row for actions.
- **Charts**: a phone variant per chart type with fewer ticks, larger touch tooltips and a legend that collapses into tappable chips.
- **Review on phone**: two swipeable panes (image, draft), pinch to zoom on the image, field list ordered by confidence ascending, numeric keyboard for stat fields, player picker as a bottom sheet with roster search.
- **Testing**: every screen is verified at 390 x 844 in both themes before a sprint closes, using the in-app browser's mobile preset, and the component gallery renders every primitive at phone width beside its desktop rendering.

---

## 8. Non-functional

- Reactive everywhere: an upload from the phone appears in the inbox on the Mac without refresh.
- Indexed reads only; no `.filter` scans in queries. Aggregates are materialized so tables are single reads.
- Imports and recomputes are idempotent and run per season so a bad extraction can be re-committed safely.
- Full export to JSON at any time (Settings → Data); a nightly backup of every franchise in Convex file storage, the last fourteen kept.
- Works offline for reading recently viewed screens (PWA cache); writes require connectivity except image captures, which queue locally.
- Feature parity between desktop and phone is a release criterion for every sprint, not a later pass.
- Secrets live in Convex env. The Shortcut token is revocable, and the endpoint is rate limited (valid tokens draw from a bucket; bad tokens are throttled separately and never lock out the owner).
- Unexpected client errors and failed scheduled jobs are reported to Settings → Errors; other backend errors are in the Convex dashboard logs.
- No unauthenticated reads or writes: every Convex query, mutation and action requires the signed-in owner (Sign in with Vercel), except the token-checked Shortcut endpoint.

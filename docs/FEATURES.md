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
- `seasons`: year, status (`upcoming`, `regular`, `postseason`, `complete`), userTeam record cache (w, l, t, divisionRank, seed, playoffResult), coaching staff (head coach, OC, DC, offensive scheme, defensive scheme), salary cap, notes.
- `seasonGoals`: pre-season goals per season, in the owner's order: scope (team or player), type (wins, division, playoffs, bye, playoff win, Super Bowl appearance or win, stat, write-in), player and stat key for stat goals, target, text, and a manual hit/missed outcome that overrides what the numbers say.
- `seasonReports`: pre-season thoughts, post-season thoughts, around-the-league notes, status of each prompt (pending or answered with timestamp, plus when the banner was last dismissed), `needs[]` (position, priority, note, resolved by a transaction or draft pick id, or by hand with a note). Created on first write.

### 4.2 League

- `teams`: abbreviation, city, name, conference, division, colors, logo storage id, ESPN id. Seeded with all 32. Relocation or rename supported via `aliases[]` with year ranges.
- `standings`: per season per team: w, l, t, divisionRank, seed, playoffResult, pointsFor, pointsAgainst. Imported from screenshot or derived for the user team.
- `leagueLeaders`: per season, per stat key, ranked rows (rank, playerId or raw name, teamId, value). Top 20 per category.
- `teamSeasonStats`: per season per team per stat key: value, rank, attempts, note. Replaces the "27.3 - T-3rd" strings.
- `leagueGames`: every game in the league for a week (away, home, scores when played, game time), from the Madden schedule screen or typed in. The user team's game also updates `games`. Every other team's standings record (W-L-T, points) is worked out from these scores plus the user team's games after any score changes; a captured standings record is only replaced when the scores cover at least as many games.

### 4.3 Players

- `players`: firstName, lastName, displayName, position, birthYear or age-at-year anchor, college, heightIn, weightLb, draft (year, round, pick, teamId) or undrafted, isReal, espnId, headshot storage id, retired flag, devTrait, abilities[], aliases[] for name resolution, notes.
- `rosterEntries`: per season per team per player: jersey, position, depthSlot, ovr, age, exp, acquisition (type: draft, FA, trade, waiver, undrafted, resign; year; detail; counterparts), contract (years, total, apy, guaranteed, expiresYear), grade note, status (active, IR, PS, released or traded away, with the week it took effect).
- `playerSnapshots`: optional mid-season OVR checkpoints (week, ovr) for progression charts.

### 4.4 Games

- `games`: season, weekKey, date label, homeTeamId, awayTeamId, userIsHome, scores, overtime, result for user team, opponent record at kickoff, playoffRound, stadium or neutral flag, weather, notes (narrative), stars[] (any number, ordered, picked by hand: playerId or typed name, team, optional caption), status (`scheduled`, `played`, `bye`).
- `gameStatLines`: per game per player per team: a flat map of stat keys from the registry (pass, rush, rec, def, kick, punt, return). One row per player per game. This is the source of truth for everything downstream.
- `gameTeamStats`: per game per team: first downs, total yards, pass yards, rush yards, turnovers, penalties, time of possession, third down, fourth down, red zone, sacks, etc.
- `scoringPlays` (optional, phase 2): quarter, clock, team, description, score after.

### 4.5 Derived and cached

- `seasonPlayerStats`: materialized per season per player per team totals, with games played, per-game averages and counts of threshold games (100-yard games, 300-yard games, 2- and 3-TD games, 5+ catch games, 2-sack and 2-INT games, perfect passer ratings), and the season high per stat with the game and week it came in (`bestGames`). Recomputed by a mutation after any stat line commit. Exists so tables and leaderboards are one indexed read.
- `careerPlayerStats`: same shape, per player, all seasons.
- `records`: franchise records per stat key per scope (single game, season, career), with holder, value, game or season reference, date set, previous holder. Recomputed incrementally.
- `milestones`: detected events (first 1000-yard season, career high, franchise record broken, streak reached) with week and acknowledgment flag. Feed the dashboard.

### 4.6 Awards, draft, transactions, Hall of Fame

- `awards`: season, weekKey or null, scope (league, conference, team), type (OPOW, DPOW, STPOW, ROW, MVP, OPOY, DPOY, OROY, DROY, CPOY, COY, SBMVP, ProBowl, AllPro1, AllPro2, BestK, BestP, BestKR, custom), conference, playerId or raw name plus teamId, statLine text, notes.
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

- Season header: team logo, record, division standing, streak, point differential, playoff status.
- **Pending prompts** card: pre-season report due (persists until answered, even if dismissed once), post-season report due after the Super Bowl week, and any open offseason needs. Clicking opens the report editor.
- **Goals**: the season's pre-season goals with progress and hits.
- **Next up / last game**: score bug for the most recent result with its stars and a snippet of the notes; opponent card for the upcoming week with head-to-head history and their record.
- **This week's milestones**: auto-detected (career highs, 100-yard games, franchise records, streaks) with one-tap acknowledge.
- **Inbox** summary: items waiting for review, with a direct link.
- **Season pulse**: small charts of points for and against by week, and team rank trend in key categories.
- **Recent transactions and injuries**.
- Decade grid teaser from History (franchise record so far).

### 5.2 Schedule

- Week list for the selected season: week, opponent with logo and record at kickoff, home/away, score, result color, overtime tag, every star as player chips, and the notes in full (the row grows to fit). Byes and playoff rounds shown as their own row types.
- Calendar view: the season laid out by week with game day emphasis; playoff rounds and offseason markers.
- Season-by-season navigation and a season summary strip (W-L, points, streaks).
- Add a game (or a bye) by hand; the user team is always one side. Edit or delete it from game detail; records, stats and standings refresh as after a box score commit.
- **Game detail**, split pane:
  - Top: score bug with quarter line if captured, team game stats side by side (user team vs opponent) with bar comparisons, stars of the game (picked by hand, any number, ordered, with captions), and the narrative notes editor on the right.
  - Bottom: full box score grouped by passing, rushing, receiving, defense, kicking, punting, returns. Dropdown for user team, opponent, or both. Highlighted performances by registry thresholds (300-yard passer, 100-yard rusher or receiver, 3 TDs, 2 sacks, 2 INTs, perfect passer rating) and career-high markers.
  - "Import screenshot" affordance on every game that opens the inbox pre-tagged with that game, and can attach screenshots already waiting in the inbox.
  - The box score, team stats and every player game log edit inline (Edit); player lines can be added and removed by hand.
- Head-to-head panel: all-time record vs this opponent inside the franchise, with links to each game.

### 5.3 Roster

- Current roster for the selected season as three tables (offense, defense, special teams): position, number, headshot, name, age, OVR, exp, college, acquisition, contract, dev trait, grade note. Each position family has its own color (the line, edges, linebackers and safeties share). Position filter, sortable, column visibility remembered.
- Averages of OVR, age and experience for the team and each side (released and traded players left out).
- Every column edits inline (Edit); "Add player" creates a player on a roster; "Move…" changes team or status for a season without logging a transaction.
- Depth chart view by position with OVR badges.
- Roster diff between two seasons: arrivals, departures, OVR change.
- Team switcher: other teams' rosters are populated from box scores, awards, league leaders and draft imports, clearly labeled as partial.
- Contract and cap view: cap hits per player, total, expiring contracts, with a "needs" link to the season report.

### 5.4 Players

- Player page: hero with the player card (headshot or monogram) in team colors, position, number, age, height and weight, college, draft slot, acquisition story, contract, dev trait and abilities (per season, on the roster entry), notes; OVR progression chart across seasons and in-season checkpoints.
- Career stats table by season with totals row, computed from game logs (real NFL seasons before the franchise are imported totals, marked), with the elite highlight rules applied per season. Postseason split toggle.
- Game log for any season with per-game highlight markers.
- Awards, records held, milestones, draft info, transactions involving the player, Hall of Fame status.
- Compare: two to four players side by side on shared stat keys with a radar or bar chart.
- Edit every player fact (names, position, birth year, college, size, draft, retired) and every season's roster entry inline, team included; Move the player.
- Identity tools: merge duplicates (suggested in Settings), rename with the old name kept as an alias, edit aliases, mark a player fictional, and apply a name corrected in review to every player still carrying the misread name.
- Headshots: imported real players arrive with their ESPN id; anyone else is matched on ESPN by name (NFL first, then college football for created players in a real draft class, ranked by school and position) and confirmed by the user, from the player page or in bulk from the roster. Photos are cached in storage. Fictional players get a generated monogram card in team colors. Manual upload supported (later).
- Players index: every player on a team's roster during the franchise (any team), filtered by position and sorted by OVR, age or seasons with the team, plus a name search across every player, real history included.

### 5.5 Stats

- Season stats by position group (QB, RB, WR/TE, OL snaps if captured, DL, LB, DB, K, P, returners) for the selected season, with the registry-driven columns, per-game averages, big-game counts that always show (QB: 300+, 3+ TD, 158.3s, 100+ rush; RB: 100+ rush, 100+ rec, 5+ rec, 2+ TD; WR/TE: 100+ rec, 5+ rec, 100+ rush, 2+ TD; DL, LB, DB: 2+ sacks, 2+ INT), and a season high per stat with a week link to that game. Single-game rates need volume (10 pass attempts, 5 carries, 3 catches, ...). Totals row.
- Player goals for the season with progress and a goal-hit marker. Leaders, team stats and season totals can be typed in.
- Elite highlighting: configurable thresholds (defaults: 100+ catches, 1000 and 1500 yards, 10+ TDs, 5000+ passing yards, 40+ passing TDs, 70%+ completion, 10+ sacks, 5+ INTs, 100+ tackles). Two tiers of highlight.
- League leaders: imported top 20 per category per season, with the user's players marked and a "where we rank" summary.
- Team stats: all team categories per season with value, rank, trend across seasons, and league context, visualized as rank ribbons rather than strings.
- Franchise records book: single game, season, career, per stat, with holder, when, and the game link. Broken records surface on the dashboard the week they fall.
- All-time leaders: career top 10 per stat within the franchise.
- Streaks: team (wins, home wins, division wins) and player (consecutive 100-yard games, games with a TD, games with a sack).

### 5.6 League

- Standings per season by conference and division, imported from screenshot, with the user team highlighted (1999–2001 in that era's six divisions).
- Scores: every game of a week across the league, from the schedule screen or typed in. Playoff seeds and bracket per season.
- Any team's history inside the franchise: record by season, playoff results, titles, their players we have seen, draft picks.
- Cumulative league table across the franchise: wins, playoff record, division titles, conference titles, Super Bowls.
- Rivals: the user team's head-to-head line against every opponent met (record, playoff record, point differential, streak, margins, last meeting); a team's page charts the margin of every meeting.

### 5.7 History

- Franchise history home: decade grids (year, W, L, T, division rank, seed and playoff result, coach, note) generated from `seasons`. Totals per decade and all time.
- Trophy room: Super Bowl wins, conference titles, division titles, playoff appearances, with years, real pre-franchise history from the external import (4.8) and editable entries, so the team's real history sits alongside franchise results.
- Pre-season goals on the season report: team goals (wins, division, playoffs, bye, playoff win, Super Bowl trip or title, write-in) and player goals (a stat target or a write-in), judged from the season as it is played, markable by hand.
- Season reports archive: for each season, pre-season thoughts, post-season thoughts, around the league, needs with resolution status, and the computed season summary next to them.
- Hall of Fame: wall of hanging jerseys in team colors with number, name, position, years, induction year, retired-number flag and a blurb; click to the player page. Add from any player page; coaches and staff are added from the wall. Retired numbers sit above the wall.
- Narrative timeline: every note across games, seasons, transactions and awards in one scrollable story, filterable by season and type.

### 5.8 Awards

- Weekly: AFC and NFC offensive, defensive and special teams players of the week, rookie of the week, with player, team and stat line. User-team winners highlighted. Imported per week.
- Yearly: MVP, OPOY, DPOY, OROY, DROY, CPOY, Coach of the Year, Super Bowl MVP, All-Pro teams, Pro Bowl rosters, and custom additional awards. Imported from the awards screens.
- Team awards defined by the user (team MVP, rookie of the year) chosen from the roster.
- Awards cabinet per player and per season.

### 5.9 Draft

- Draft history from the franchise start: per season, every user pick with round, overall, position, player, OVR at draft, college, note, trade origin.
- Draft class retrospective: computed hit rating from OVR progression, starts and awards, shown as a grade after two seasons.
- Pick inventory: future picks owned and owed, how acquired.
- Draft board (lightweight): pre-draft needs from the season report, prospects the user noted (in their own order, `draftBoard`), who they took.
- League-wide first round import when available, so other teams' rookies get player entities.

### 5.10 Transactions and injuries

- Transaction log per season with type filters, contract terms, trade detail, and the player chips, ordered by phase and week. Resign and extension tracked with cap effect.
- Record trades (two teams, players and picks by year and round, a note), free agent signings and every other move by hand, with when it happened (phase and week). Rosters and pick ownership follow; editing or deleting undoes exactly what the move changed. Injuries are logged, edited and deleted by hand too.
- Injury report per season with length and IR flag, shown on the roster and the player page.
- Trade tracker: each trade with assets in and out and a retrospective note.

### 5.11 Ingestion

- **Inbox**: grid of uploads with thumbnails, target tag, season and week, status and age. Batch select. Keyboard driven.
- **Capture paths**: Apple Shortcut (share sheet or home screen: pick photos, choose target from a menu generated from the registry, optional week, POST with bearer token), web upload on the phone, drag and drop or paste onto the Mac app, and "Import screenshot" buttons on game, season, awards and draft screens that pre-fill the target and context.
- **Extraction**: Convex action per upload. Chooses the prompt and JSON schema from the target registry, attaches recent corrections as few-shot examples, calls OpenRouter with a primary vision model and a fallback, validates the JSON (completions ≤ attempts, yards consistent with per-game lines, names resolved to roster), and stores a draft with per-field confidence and warnings. A box score's screenshots are sent a few per request (at most 3 and about 20 MB, under providers' image caps) and the answers merged before normalizing, so review sees one draft. A run can be stopped or restarted from the inbox or review at any time (a superseded run's answer is dropped), gives up with a clear error before Convex's 10-minute action limit, and a watchdog fails any run that never reports back, so a set is never stuck reading.
- **Review**: side-by-side image and editable draft. Low-confidence and warned fields are highlighted. Player names resolve to roster chips with a picker for ambiguous matches. Assignments are remembered per franchise, season and team, including choices saved before commit. Numeric recommendations have an Apply button; doubtful values can be approved, and player suggestions assigned or changed directly from Check first. One keystroke to commit, reject, or re-run with a different model. Duplicate detection if the same game or week already has data.
- **Commit**: writes canonical rows, recomputes the affected season and career aggregates, records, streaks and milestones, and stores any corrections.
- **Targets (v1)**: full game log (the default: team and player stats screenshots in one upload, review and commit), game result and box score, and team game stats. Total yards is always passing plus rushing, excluding Madden's return-inclusive total. Team game stats are keyed by a team stat registry (`shared/stats/teamRegistry.ts`) the way player stats are keyed by the stat registry. **Targets (v2)**: season player stats per position group, league leaders top 20, team season stats, standings, weekly awards, yearly awards, draft results, roster page, transactions, injury report, player card.
- Every target has a scope: one game, one week or the season. A set extracts once it has the context its scope needs; capture paths infer the season and week when they are not picked.
- Multi-image targets: a box score split across screenshots is grouped into one upload set and read together; a list (standings, leaders, a roster, the draft) is read a screenshot at a time and merged as the union of its rows. List rows are reviewed as cards and accepted one by one; only accepted rows commit.
- **Reconciliation**: season totals from a season stats screenshot are checked against the totals derived from game logs (never replacing them). Each difference is settled by accepting the log number or flagging a missing game, with the weeks that lack a box score listed.
- **Schedule / scores** target: the week's league schedule screen into `leagueGames`.
- **Enter manually**: every target has a typed-in counterpart in the same review editors (from the Inbox, Awards, Draft and Stats), saved as you go and committed through the same path.
- Cost and latency panel in Settings with per-model usage.

### 5.12 Settings

- Franchises: every franchise with its team and current season, switching the active one, and "New franchise".
- Franchise: team, start year, season length, playoff format.
- Thresholds: edit elite highlight thresholds per stat.
- Models: OpenRouter primary and fallback model, temperature, token budget. Both are picked from saved model presets (the defaults plus any the user adds; saving a new model adds it), with an "Other model" field for any id. The re-run sheet uses the same presets.
- Shortcut: generate and revoke tokens, download the Shortcut file, test endpoint.
- Data: refresh the real NFL history import; back up every franchise now (and nightly, keeping fourteen) as gzipped JSON to download; restore a listed backup or a file as new, inactive franchises (never overwriting); export the active franchise's games and player seasons as CSV. Backups leave out inbox screenshots and Shortcut tokens (docs/LAUNCH.md).
- Franchises: delete any franchise, the active one included, after an "are you sure" and typing its name; the franchise used before it takes over (or setup when none is left), and its rows go in the background.
- Real NFL history: add 1999–2001 to a franchise imported from 2002.
- Errors: unexpected errors from any device, one row per distinct error with a count.
- Appearance: team color intensity, density, reduced motion.

### 5.13 Mobile parity

Every feature in 5.1 through 5.12 ships on the phone with the same data, filters, sorting, editing, review and commit capabilities. Nothing is desktop-only. Specific behaviors:

- **Navigation**: bottom tab bar, "More" sheet, page headers with back navigation and the season switcher, swipe between weeks on Schedule and between seasons on History.
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
- **Testing**: every screen is verified at 390 x 844 and 430 x 932 in both themes before a sprint closes, using the in-app browser's mobile preset, and the component gallery renders every primitive at phone width beside its desktop rendering.

---

## 8. Non-functional

- Reactive everywhere: an upload from the phone appears in the inbox on the Mac without refresh.
- Indexed reads only; no `.filter` scans in queries. Aggregates are materialized so tables are single reads.
- Imports and recomputes are idempotent and run per season so a bad extraction can be re-committed safely.
- Full export to JSON at any time (Settings → Data); a nightly backup of every franchise in Convex file storage, the last fourteen kept.
- Works offline for reading recently viewed screens (PWA cache); writes require connectivity except image captures, which queue locally.
- Feature parity between desktop and phone is a release criterion for every sprint, not a later pass.
- Secrets live in Convex env. The Shortcut token is revocable, and the endpoint is rate limited (valid tokens draw from a bucket; bad tokens are throttled separately and never lock out the owner).
- Unexpected client errors are reported to Settings → Errors; backend errors are in the Convex dashboard logs.
- No unauthenticated reads or writes: every Convex query, mutation and action requires the signed-in owner (Sign in with Vercel), except the token-checked Shortcut endpoint.

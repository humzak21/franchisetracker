# FranchiseTracker — Feature Specification

A Football Manager style front end for a Madden franchise, minus the game. One user, one franchise at a time (the model supports several), fed by photos and screenshots the user takes during and after each game, parsed into structured data, and reviewed before commit.

This document is the product source of truth. `SPRINTS.md` turns it into build order.

---

## 1. Principles

1. **Game logs are the source of truth.** Every season total, career total, record, streak, highlight and leaderboard is derived from per-game stat lines. The user never types a season total. Season-level imports exist only to backfill history or reconcile a missed game.
2. **One definition per stat.** A single stat registry (`shared/stats/registry.ts`) declares every stat once: key, label, abbreviation, position group, formatter, aggregation (sum, max, rate), elite threshold, sort direction, and the extraction field it maps to. Tables, highlights, leaderboards, records, player pages, extraction JSON schemas and the spreadsheet importer all read from it. Adding a stat is one registry entry.
3. **One definition per ingestion target.** An ingestion target registry declares each kind of screenshot once: name, which season/week context it needs, its JSON schema, prompt template, review form, and commit mutation. The Shortcut menu, the inbox tag list, the extraction action and the review UI are all generated from it.
4. **Structured first, prose alongside.** Everything the spreadsheet stored as text with numbers inside ("Maye - 20/26, 203 yds, 2 TD", "27.3 - T-3rd", "Raiders (0-0)", "D 2024") becomes typed fields. Free-text notes stay, as their own field, everywhere the user wants to write.
5. **Players are entities, not strings.** A player exists once league-wide with stable identity across seasons, teams, jersey changes and name typos. Rosters, stat lines, awards, draft picks, transactions and Hall of Fame entries reference the player id.
6. **Review before commit.** Nothing parsed from an image lands in canonical tables without the user confirming it. Corrections are stored and reused as few-shot examples, which is how extraction improves over time.
7. **Beauty is a requirement.** Dark broadcast-graphics aesthetic, team-color accents, tabular numerals, dense but breathable tables, meaningful motion, and purposeful charts. Every screen has an empty state and a loading state that look intentional.

---

## 2. Platform and architecture

| Layer | Choice | Notes |
|---|---|---|
| Front end | Vite, React 19, TypeScript, TanStack Router, TanStack Table, TanStack Query is not needed (Convex handles data) | Installed as a PWA in Safari or Chrome on the Mac. Optional Tauri wrapper later. |
| Styling | Tailwind v4, shadcn/ui primitives, Radix, Lucide icons, Recharts | Design tokens in CSS variables; team colors injected at runtime. |
| Backend | Convex: database, file storage, actions, HTTP endpoints, scheduled functions | Single deployment. Schema split by domain under `convex/`. |
| Shared logic | `shared/` TypeScript package consumed by both `convex/` and `src/` | Stat registry, stat math (passer rating, averages, pace), formatters, validators, ingestion target registry. |
| Vision extraction | OpenRouter from a Convex action, structured output with a JSON schema per target, model fallback chain | Key stored as a Convex env var. Never on the client. |
| External data | ESPN unofficial site API from Convex actions | Headshots, team logos and colors, real-player bios. Cached in Convex storage. |
| Phone companion | Apple Shortcut on the share sheet and home screen, posting to a Convex HTTP endpoint with a bearer token. The web app also works on the phone as a fallback uploader. | Zero native code. |
| Auth | Single-user: Convex Auth with password, or a signed secret for the Shortcut endpoint | Franchise data is private. |
| Hosting | Vercel, Netlify or Convex hosting for the static front end; Convex cloud for the backend | Any device can open the URL. |

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
    import-xlsx/       one-time migration from the original workbook
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

---

## 4. Data model

All tables carry `franchiseId`. Years are integers (`2025`). Weeks use a `weekKey` enum: `pre1..pre3`, `w1..w18`, `wc`, `div`, `conf`, `sb`, `probowl`.

### 4.1 Franchise and seasons

- `franchises`: name, userTeamId, startYear, settings (games per season, playoff teams, elite thresholds overrides), active flag.
- `seasons`: year, status (`upcoming`, `regular`, `postseason`, `complete`), userTeam record cache (w, l, t, divisionRank, seed, playoffResult), coaching staff (head coach, OC, DC, offensive scheme, defensive scheme), salary cap, notes.
- `seasonReports`: pre-season thoughts, post-season thoughts, around-the-league notes, status of each prompt (pending or answered with timestamp), `needs[]` (position, priority, note, resolvedBy transaction or draft pick id).

### 4.2 League

- `teams`: abbreviation, city, name, conference, division, colors, logo storage id, ESPN id. Seeded with all 32. Relocation or rename supported via `aliases[]` with year ranges.
- `standings`: per season per team: w, l, t, divisionRank, seed, playoffResult, pointsFor, pointsAgainst. Imported from screenshot or derived for the user team.
- `leagueLeaders`: per season, per stat key, ranked rows (rank, playerId or raw name, teamId, value). Top 20 per category.
- `teamSeasonStats`: per season per team per stat key: value, rank, attempts, note. Replaces the "27.3 - T-3rd" strings.

### 4.3 Players

- `players`: firstName, lastName, displayName, position, birthYear or age-at-year anchor, college, heightIn, weightLb, draft (year, round, pick, teamId) or undrafted, isReal, espnId, headshot storage id, retired flag, devTrait, abilities[], aliases[] for name resolution, notes.
- `rosterEntries`: per season per team per player: jersey, position, depthSlot, ovr, age, exp, acquisition (type: draft, FA, trade, waiver, undrafted, resign; year; detail; counterparts), contract (years, total, apy, guaranteed, expiresYear), grade note, status (active, IR, PS, released midseason with week).
- `playerSnapshots`: optional mid-season OVR checkpoints (week, ovr) for progression charts.

### 4.4 Games

- `games`: season, weekKey, date label, homeTeamId, awayTeamId, userIsHome, scores, overtime, result for user team, opponent record at kickoff, playoffRound, stadium or neutral flag, weather, notes (narrative), stars[] (three ordered playerIds with optional caption), status (`scheduled`, `played`, `bye`).
- `gameStatLines`: per game per player per team: a flat map of stat keys from the registry (pass, rush, rec, def, kick, punt, return). One row per player per game. This is the source of truth for everything downstream.
- `gameTeamStats`: per game per team: first downs, total yards, pass yards, rush yards, turnovers, penalties, time of possession, third down, fourth down, red zone, sacks, etc.
- `scoringPlays` (optional, phase 2): quarter, clock, team, description, score after.

### 4.5 Derived and cached

- `seasonPlayerStats`: materialized per season per player per team totals, with games played, per-game averages and counts of threshold games (100-yard games, 300-yard games, 3-TD games). Recomputed by a mutation after any stat line commit. Exists so tables and leaderboards are one indexed read.
- `careerPlayerStats`: same shape, per player, all seasons.
- `records`: franchise records per stat key per scope (single game, season, career), with holder, value, game or season reference, date set, previous holder. Recomputed incrementally.
- `milestones`: detected events (first 1000-yard season, career high, franchise record broken, streak reached) with week and acknowledgment flag. Feed the dashboard.

### 4.6 Awards, draft, transactions, Hall of Fame

- `awards`: season, weekKey or null, scope (league, conference, team), type (OPOW, DPOW, STPOW, ROW, MVP, OPOY, DPOY, OROY, DROY, CPOY, COY, SBMVP, ProBowl, AllPro1, AllPro2, BestK, BestP, BestKR, custom), conference, playerId or raw name plus teamId, statLine text, notes.
- `draftPicks`: season, round, pick overall, pick in round, teamId, playerId, position, ovr at draft, college, notes, trade note, origin pick (acquired from), retrospective grade (computed later from OVR progression and starts).
- `draftPickInventory`: future picks owned, with origin team and how acquired.
- `transactions`: season, weekKey, type (sign, resign, release, trade, waiver claim, IR, activate, extension, restructure, retire), players in and out, picks in and out, counterpart team, contract terms, notes.
- `injuries`: season, weekKey, playerId, type, length, IR flag.
- `hofEntries`: playerId or staff name, role, jersey, inducted year, retired number flag, blurb, highlight seasons, career summary cache.

### 4.7 Ingestion

- `uploads`: storage id, mime, width, height, source (shortcut, web, dragdrop), target key or null, season, weekKey, status (`queued`, `extracting`, `review`, `committed`, `rejected`, `failed`), error, createdAt.
- `extractions`: upload id, target key, model used, raw JSON, normalized draft, confidence per field, warnings from validators, token usage, latency.
- `corrections`: target key, field path, extracted value, corrected value, image crop reference, used-as-example flag. Feeds few-shot prompts.
- `ingestionTokens`: hashed bearer tokens for the Shortcut.

---

## 5. Features by area

### 5.1 Home (dashboard)

- Season header: team logo, record, division standing, streak, point differential, playoff status.
- **Pending prompts** card: pre-season report due (persists until answered, even if dismissed once), post-season report due after the Super Bowl week, and any open offseason needs. Clicking opens the report editor.
- **Next up / last game**: score bug for the most recent result with three stars and a snippet of the notes; opponent card for the upcoming week with head-to-head history and their record.
- **This week's milestones**: auto-detected (career highs, 100-yard games, franchise records, streaks) with one-tap acknowledge.
- **Inbox** summary: items waiting for review, with a direct link.
- **Season pulse**: small charts of points for and against by week, and team rank trend in key categories.
- **Recent transactions and injuries**.
- Decade grid teaser from History (franchise record so far).

### 5.2 Schedule

- Week list for the selected season: week, opponent with logo and record at kickoff, home/away, score, result color, overtime tag, three stars as player chips, notes preview. Byes and playoff rounds shown as their own row types.
- Calendar view: the season laid out by week with game day emphasis; playoff rounds and offseason markers.
- Season-by-season navigation and a season summary strip (W-L, points, streaks).
- **Game detail**, split pane:
  - Top: score bug with quarter line if captured, team game stats side by side (user team vs opponent) with bar comparisons, three stars, and the narrative notes editor on the right.
  - Bottom: full box score grouped by passing, rushing, receiving, defense, kicking, punting, returns. Dropdown for user team, opponent, or both. Highlighted performances by registry thresholds (300-yard passer, 100-yard rusher or receiver, 3 TDs, 2 sacks, 2 INTs, perfect passer rating) and career-high markers.
  - "Import screenshot" affordance on every game that opens the inbox pre-tagged with that game.
- Head-to-head panel: all-time record vs this opponent inside the franchise, with links to each game.

### 5.3 Roster

- Current roster table for the selected season: position, number, headshot, name, age, OVR, exp, college, acquisition, contract, dev trait, grade note. Grouped by offense, defense, special teams, with position filter and depth ordering. Sortable, searchable, and column visibility is remembered.
- Depth chart view by position with OVR badges.
- Roster diff between two seasons: arrivals, departures, OVR change.
- Team switcher: other teams' rosters are populated from box scores, awards, league leaders and draft imports, clearly labeled as partial.
- Contract and cap view: cap hits per player, total, expiring contracts, with a "needs" link to the season report.

### 5.4 Players

- Player page: hero with headshot, team colors, position, number, age, OVR with progression chart across seasons, college, acquisition story, contract, dev trait and abilities, notes.
- Career stats table by season with totals row, computed from game logs, with the elite highlight rules applied per season. Postseason split toggle.
- Game log for any season with per-game highlight markers.
- Awards, records held, milestones, draft info, transactions involving the player, Hall of Fame status.
- Compare: two to four players side by side on shared stat keys with a radar or bar chart.
- Identity tools: merge duplicates, add alias, correct a mis-extracted name once and have it remembered.
- Headshots: fetched from ESPN for real players by name match, confirmed by the user, cached. Fictional players get a generated monogram card in team colors. Manual upload supported.

### 5.5 Stats

- Season stats by position group (QB, RB, WR/TE, OL snaps if captured, DL, LB, DB, K, P, returners) for the selected season, with the registry-driven columns, per-game averages, threshold counts, and best-game columns derived from logs. Totals row.
- Elite highlighting: configurable thresholds (defaults: 100+ catches, 1000 and 1500 yards, 10+ TDs, 5000+ passing yards, 40+ passing TDs, 70%+ completion, 10+ sacks, 5+ INTs, 100+ tackles). Two tiers of highlight.
- League leaders: imported top 20 per category per season, with the user's players marked and a "where we rank" summary.
- Team stats: all team categories per season with value, rank, trend across seasons, and league context, visualized as rank ribbons rather than strings.
- Franchise records book: single game, season, career, per stat, with holder, when, and the game link. Broken records surface on the dashboard the week they fall.
- All-time leaders: career top 10 per stat within the franchise.
- Streaks: team (wins, home wins, division wins) and player (consecutive 100-yard games, games with a TD, games with a sack).

### 5.6 League

- Standings per season by conference and division, imported from screenshot, with the user team highlighted. Playoff seeds and bracket per season.
- Any team's history inside the franchise: record by season, playoff results, titles, their players we have seen, draft picks.
- Cumulative league table across the franchise: wins, playoff record, division titles, conference titles, Super Bowls.

### 5.7 History

- Franchise history home: decade grids (year, W, L, T, division rank, seed and playoff result, coach, note) exactly like the spreadsheet but generated. Totals per decade and all time.
- Trophy room: Super Bowl wins, conference titles, division titles, playoff appearances, with years, real-history pre-franchise entries editable so the Patriots' real history can sit alongside franchise results.
- Season reports archive: for each season, pre-season thoughts, post-season thoughts, around the league, needs with resolution status, and the computed season summary next to them.
- Hall of Fame: wall of hanging jerseys in team colors with number, name, position, years, induction year, retired-number flag and a blurb; click to the player page. Add from any player page.
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
- Draft board (lightweight): pre-draft needs from the season report, prospects the user noted, who they took.
- League-wide first round import when available, so other teams' rookies get player entities.

### 5.10 Transactions and injuries

- Transaction log per season with type filters, contract terms, trade detail, and the player chips. Resign and extension tracked with cap effect.
- Injury report per season with length and IR flag, shown on the roster and the player page.
- Trade tracker: each trade with assets in and out and a retrospective note.

### 5.11 Ingestion

- **Inbox**: grid of uploads with thumbnails, target tag, season and week, status and age. Batch select. Keyboard driven.
- **Capture paths**: Apple Shortcut (share sheet or home screen: pick photos, choose target from a menu generated from the registry, optional week, POST with bearer token), web upload on the phone, drag and drop or paste onto the Mac app, and "Import screenshot" buttons on game, season, awards and draft screens that pre-fill the target and context.
- **Extraction**: Convex action per upload. Chooses the prompt and JSON schema from the target registry, attaches recent corrections as few-shot examples, calls OpenRouter with a primary vision model and a fallback, validates the JSON (completions ≤ attempts, yards consistent with per-game lines, names resolved to roster), and stores a draft with per-field confidence and warnings.
- **Review**: side-by-side image and editable draft. Low-confidence and warned fields are highlighted. Player names resolve to roster chips with a picker for ambiguous matches. One keystroke to commit, reject, or re-run with a different model. Duplicate detection if the same game or week already has data.
- **Commit**: writes canonical rows, recomputes the affected season and career aggregates, records, streaks and milestones, and stores any corrections.
- **Targets (v1)**: game result and box score (one or several screenshots), team game stats. **Targets (v2)**: season player stats per position group, league leaders top 20, team season stats, standings, weekly awards, yearly awards, draft results, roster page, transactions, injury report, player card.
- Multi-image targets: a box score split across screenshots is grouped into one upload set and merged.
- Cost and latency panel in Settings with per-model usage.

### 5.12 Settings

- Franchise: team, start year, season length, playoff format.
- Thresholds: edit elite highlight thresholds per stat.
- Models: OpenRouter primary and fallback model, temperature, token budget.
- Shortcut: generate and revoke tokens, download the Shortcut file, test endpoint.
- Data: import from the original workbook, export JSON and CSV, full backup, restore.
- Appearance: team color intensity, density, reduced motion.

### 5.13 Search and keyboard

- `⌘K` command palette: players, games (by week or opponent), seasons, screens, and actions (new upload, open report).
- Shortcuts: `[` `]` for previous and next week, `S` to switch season, `I` for the inbox, `?` for the shortcut sheet.

---

## 6. Spreadsheet shortcuts and their fixes

| In the workbook | In the app |
|---|---|
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

---

## 8. Non-functional

- Reactive everywhere: an upload from the phone appears in the inbox on the Mac without refresh.
- Indexed reads only; no `.filter` scans in queries. Aggregates are materialized so tables are single reads.
- Imports and recomputes are idempotent and run per season so a bad extraction can be re-committed safely.
- Full export to JSON at any time; nightly Convex backup.
- Works offline for reading recently viewed screens (PWA cache); writes require connectivity.
- Secrets live in Convex env. The Shortcut token is revocable.

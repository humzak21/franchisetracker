# Statistics hub: plan

A plan for turning Stats from six tables into a statistics hub for **the franchise's team and its players**: trends, pacing, year over year, splits, cumulative races, "fastest to" lists, best N-game spans, streaks with dates, and a stat explorer that answers the questions none of the fixed screens anticipated. Other teams stay context (standings, box scores, end-of-year leaders); nothing here ranks another team's players beyond what the league book already does.

This is a plan, not a spec: when a sprint below is picked up, its "As built" notes go into `SPRINTS.md` and the stable behaviour into `FEATURES.md` 5.5. The audit that produced it is `docs/PLATFORM-AUDIT.md`.

---

## 1. Where the stats stand today

What exists (all derived from game logs, `shared/stats/*`, `convex/stats/*`):

- **Season and career rows** (`seasonPlayerStats`, `careerPlayerStats`): totals, averages, threshold-game counts, best single game per stat, and on season rows the game each high came in (`bestGames`).
- **Three records books** (team, franchise era, all-time) by single game, season and career, top 20 per list, typed entries, every placement on the player page.
- **Streaks**: three team streaks and five player streaks, each stored as `current` and `longest` only.
- **Milestones**: threshold games, career highs, first threshold season, franchise record broken, team win streak marks.
- **Team**: `seasons.teamTotals` derived from each game's team stats, captured team ranks per season, rank ribbons across seasons, points by week, margin and running streak charts, rivals, head to head.
- **Charts**: `PointsChart`, `DivergingBars`, `TrendChart` (OVR only), `RadarCompare`, `Sparkline`, `RankTrend`.

What does not exist, anywhere:

| Gap | Detail |
|---|---|
| Running totals | Nothing stores or computes a cumulative total after game N, so there is no "fastest to", no cumulative chart, no race against a record pace. |
| Pace | `shared/stats/math.ts:pace()` exists but is used only by a test. No projection anywhere, for players or the team. |
| Year over year | No player season-to-season delta. The only cross-season delta is the team's rank change. |
| Multi-season player trends | A per-stat `Sparkline` on the career card is the only one; there is no chart with axes, no overlay of seasons. |
| Spans | No sliding-window computation ("most TDs in any 5 games"). Streaks are boolean runs only. |
| Splits | No home/away, win/loss, division, opponent, month, or quarter splits for players or the team. |
| Streak detail | No start and end, no per-season streaks, no "active" list with dates; only team win streaks produce milestones. |
| Single-game lists | Each player-season contributes its best game only, so a player's second-best game never appears (`SPRINTS.md` Sprint 3). |
| Team records | No team-level record lists (most points in a game, biggest win, biggest comeback, best season differential). `lineScore` (points by quarter) is captured but never aggregated. |
| Cross-season game log | The only game-log query is per season; career game logs, filters ("every 100-yard game") and sorts do not exist. |
| Countdowns | Nothing says "87 yards from 10,000" before it happens; milestones fire after the fact. |
| Scoring plays | Madden's scoring summary screen is not captured. Without it there is no play-by-play of a game, no exact quarter scoring, no game-winning score, no QB-to-receiver connection count, no longest touchdown, no clutch field goal. `scoringPlays` has sat in `FEATURES.md` 4.4 as "optional, phase 2" since Sprint 0. |

---

## 2. Principles for the hub

1. **Everything derives from `gameStatLines` and `games`.** No new typed numbers. Imported real seasons have totals but no games, so anything per game (fastest to, spans, cumulative races, splits) is franchise era only and says so; career "fastest to" for a real player counts franchise games from his imported totals as the starting point (section 4.2).
2. **Materialize what ranks across players; compute on read what belongs to one player or the team.** One player's career is at most about 400 lines, the team's games about 400; a query can fold those. Leaderboards cannot scan every player, so marks and spans are stored as boards the same way records are.
3. **Registries, not hard-coded lists.** Marks (`1,000 rushing yards`), windows (`3, 5, 10 games`), split kinds and team record stats are each declared once in `shared/stats/` and drive the engine, the screens, the explorer and the tests.
4. **Each new view reads one indexed query** and ships with a `Skeleton`, an `EmptyState` that says what to capture, and a phone layout from its own width.
5. **Incremental refresh stays bounded.** `stats/refresh:afterGame` already loads each box-score player's whole career; the new engines fold over those lines in the same mutation. Nothing new re-ranks the league on commit.
6. **Honest numbers.** A pace is labelled a pace, a span that crosses seasons says so, a list built from incomplete logs shows the "games missing" count from the reconcile view, and single-season lists are regular season unless the split says playoffs.

---

## 3. Information architecture

`/stats` becomes a hub with these views (`Segmented`, scrolls on the phone, remembered in local storage as today):

| View | What it holds | Status |
|---|---|---|
| **Overview** | Headline tiles for the selected season: record and pace, point differential and Pythagorean wins, top three producers, active streaks, next milestones (countdowns), records set this season, "where we rank" league context. Each tile links into its view. | New |
| **Players** | Today's Season view: position-group tables, big games, season highs, goals. Adds a pace column set (`on pace for`) while the season is in progress and a YoY delta toggle. | Extend |
| **Team** | Today's rank ribbons, plus: season-by-season results chart, points for and against by season and by week, quarter scoring, splits (home/away, division, one-score games, overtime, by opponent), team single-game and season records. | Extend |
| **Trends** | Multi-year charts for any player on the roster or the team: per-stat lines across seasons with YoY deltas, cumulative season overlays (this year against last year against the best year), per-game rolling averages. | New |
| **Records** | Today's three books, plus the new scopes: **fastest to** a mark, **best N-game span**, team records, scoring records (longest touchdowns, game-winning scores, connections), and the full single-game list (every game, not one per season). | Extend |
| **Streaks** | Active streaks with start dates, longest ever with their span, per season; new streak kinds. | Extend |
| **Explorer** | Build a question: stat, scope (game, season, career, span N, fastest to mark), split, position, minimums, season range, and a chart or table of the result, with a share-able URL. The "etc, etc, etc" screen. | New |
| **League** | Unchanged (other teams' context). | Keep |

The player page gains sections that reuse the same components: **Pace** (current season), **Trends** (YoY table and chart), **Cumulative** (season overlays), **Splits**, **Milestone timeline** (the date he reached each mark), and the new record placements (fastest to, spans). Game log gains a career mode with filters.

Home gains a **Countdowns** card (next marks within reach) and a **Pace** line in the season header ("on pace for 12-5, 410 points").

---

## 4. The engines (shared, pure, unit tested)

All new modules live in `shared/stats/` and follow the existing style: a registry constant, pure functions over `StatLine[]` and game-like rows, no Convex types.

### 4.1 `ledger.ts`: running totals

`runningTotals(lines, stat)` returns, per game in order, the cumulative value, the game index within the career and within the season, and the season and week. One pass, no storage. Used by cumulative charts, marks and spans. Ordering is the existing `(season.year, weekIndex)`.

### 4.2 `marks.ts`: fastest to a mark

```ts
export const MARKS: Record<RawStatKey, readonly number[]> = {
  passYds: [1000, 5000, 10000, 20000, 30000, 40000, 50000],
  passTd:  [10, 50, 100, 200, 300, 400],
  rushYds: [1000, 2000, 5000, 10000, 15000],
  rushTd:  [10, 25, 50, 100],
  rec:     [100, 250, 500, 1000],
  recYds:  [1000, 2000, 5000, 10000, 15000],
  recTd:   [10, 25, 50, 100],
  tackles: [100, 250, 500, 1000],
  sacks:   [10, 25, 50, 100, 150, 200],
  defInt:  [5, 10, 25, 50],
  fgm:     [50, 100, 200, 300],
  // scrimmage yards and total TDs through the derived keys
};
```

Three horizons, each a list a player can place on:

| Horizon | Question | Count from | Book |
|---|---|---|---|
| **Career** | Fastest to 10,000 rushing yards, by games played | first career game | Franchise era; Team (imported seasons count as a starting total with their `gamesPlayed`, so a real veteran's "games to 10,000" is right but his curve starts at the franchise); All-time only as typed entries |
| **Season** | Fastest to 1,000 yards in a season, by games (ties broken by week, then by yards over) | week 1 of that season | Franchise era and Team |
| **Team tenure** | Fastest to a mark with the team | first game with the team | Team |

`reachedMarks(lines, stat)` yields `{ mark, gamesToReach, seasonId, weekKey, gameId, valueAtReach }` for every mark crossed. For imported seasons it adds `gamesPlayed` from the season row to the starting count. A mark reached is also a **milestone** (kind `mark`), and the game that reaches it carries a badge in the game log and the box score.

### 4.3 `spans.ts`: best N consecutive games

`WINDOWS = [2, 3, 4, 5, 8, 10]` games, over the games the player appeared in (a game without a line is not a game for him; a DNP does not break a span). `bestSpans(lines, stat, window)` returns the best window's `value`, start and end game, whether it crosses seasons, and `second` best that does not overlap. Stats: the `RECORD_STATS` summed ones. Season-contained spans are the same function over one season's lines.

### 4.4 `pace.ts`: projections

`seasonPace(total, gamesPlayed, gamesPerSeason)` (promotes the unused `pace()`), plus `paceTargets(total, games, targets[])`: for each target (last season's total, career best, franchise record, team record, the next mark, tier 1 and tier 2 thresholds) whether he is on pace, the projected finish, and the per-game rate needed from here. Team side: projected record, points for and against, and `pythagoreanWins(pf, pa, games)` (exponent 2.37). All read-time, from rows the screens already load; `gamesPerSeason` comes from franchise settings.

### 4.5 `yoy.ts`: year over year

`yearOverYear(seasonRows)` returns per stat the value, the delta and the percent change from the previous season with the team, flagged when either season has fewer than a minimum of games (default 8) so a two-game cameo never reads as a 400 percent jump. `careerShape(rows)` adds the peak season per stat and the age (from `ageAnchor` or `birthYear`) at each season for age curves.

### 4.6 `splits.ts`: per-game splits

A split is a `(label, applies(gameContext))` pair, declared once:

```ts
export const SPLITS = {
  venue:     [{ key: "home" }, { key: "away" }],
  outcome:   [{ key: "wins" }, { key: "losses" }],
  opponent:  [{ key: "division" }, { key: "conference" }, { key: "nonConference" }],
  margin:    [{ key: "oneScore", applies: |margin| <= 8 }, { key: "blowout", applies: |margin| >= 17 }],
  phase:     [{ key: "firstHalf", weeks 1–9 }, { key: "secondHalf" }, { key: "playoffs" }],
  overtime:  [{ key: "overtime" }],
  byOpponent: one entry per opponent team met,
} 
```

`splitLines(lines, games, split)` groups a player's (or the team's) games and aggregates each group with `summarizeGames`, so every split shows the same columns as a season row. Computed on read: a player's lines are bounded (section 2), the team's games too.

### 4.7 `quarters.ts` and `teamRecords.ts`: the team as a subject

From `games.lineScore` and scores: points per quarter for and against, first-half and second-half differentials, comebacks (trailing after three quarters and won), blown leads, largest deficit overcome, games won when trailing at the half, record when scoring first (not captured; skip), record by points scored band. From `gameTeamStats`: team single-game and season records keyed by `TEAM_STATS` and `TEAM_SEASON_STATS` (most yards, fewest yards allowed, most sacks, best third-down day). `TEAM_RECORD_STATS` is the registry: stat, scope (game, season), direction, label, and whether it needs `gameTeamStats` or only the score.

### 4.8 `streaks.ts`: extended

Keep `runs()` but return each run's start and end item, so a streak stores `{ current, longest, longestFrom, longestTo, currentFrom }` with season and week on each end. New streak kinds:

- Player: games with 100+ scrimmage yards, games with a catch, games with a reception TD, games with a sack or TFL, games with a takeaway (INT, FF or FR), games without an interception thrown (QBs), games with a field goal made, consecutive games played (appearances).
- Team: road wins, games scoring 30+, games allowing under 20, games with a takeaway, one-score wins; and season-level runs: winning seasons, playoff appearances, division titles, double-digit win seasons.

Player streak milestones fire at 5, 10, 15 and 20; the "active" board on the hub shows every current run of three or more with its start.

### 4.9 Single-game lists, complete

`rankStat` with scope `game` ranks each player-season's best game because season rows carry only one best. Store, per season row, the top three games per record stat in `bestGames` (today it keeps one), and let the game-scope ranking take all three. Three per player-season is enough for a top 20 in practice; the record itself was already exact. The explorer's full list reads game lines directly for one stat and one season (bounded).

### 4.10 Scoring plays: the game as a sequence (priority)

Madden's scoring summary screen lists every score of a game: quarter, clock, team, the play ("D. Maye 15 yd pass to K. Boutte (A. Borregales kick)"), and the score after it. Occasionally a glitch drops the player's name from a line. That screen becomes an ingestion target, the plays become rows in a new table, and everything in this hub that is about *when* something happened reads them.

**The target** `scoring_plays` is a row target (`shared/ingestion/rows`) with **game scope**, the first row target tied to a game (row targets are season or week scoped today; the scope machinery already exists for the game targets). It accepts several screenshots (a long game spans two screens) and merges rows by `(quarter, clock, team)`. Fields:

| Field | Type | Notes |
|---|---|---|
| `quarter` | enum 1, 2, 3, 4, OT, OT2 | required |
| `clock` | text `mm:ss` left in the period | required; normalized to seconds |
| `team` | team | required; one of the game's two teams |
| `kind` | enum `pass_td`, `rush_td`, `fg`, `safety`, `int_td`, `fumble_td`, `kick_return_td`, `punt_return_td`, `blocked_kick_td`, `other` | required; read from the description |
| `yards` | int | the play's length where printed |
| scorer (`name`) | player | the row's player; **optional**, because of the glitch |
| `passer` | player name | the thrower on a pass TD |
| `pat` | enum `kick`, `kick_failed`, `two`, `two_failed`, `none` | for touchdowns, from the parenthesis |
| `homeScore`, `awayScore` | int | the score after the play; required |

**Normalizer and validator** (pure, tested): rows sorted by period then clock descending; each row's points must match its kind (6 plus the PAT, 3, 2) and the running score must only go up by that amount; the last row must equal the game's final; when the game has a box score, each team's touchdowns by type must agree with the box score's `passTd`, `rushTd`, `recTd`, `defTd` and return TDs (a mismatch is a warning naming the player and the count); a row with no scorer gets a "needs a player" attention item.

**Resolution for the glitch.** The candidate pool for a scorer is the game's own box score lines for that team, ranked by the stat the kind implies (a `pass_td` scorer is someone with a receiving touchdown in this box score who is not yet on a scoring play, a `rush_td` scorer someone with a rushing TD, a passer someone with a passing TD), then the team's roster. In most games that narrows a missing name to one person, and the picker opens on him. The same picker works on a row whose name was read but matched badly. A row can commit with no scorer: the game page then shows "1 scoring play needs a player" with the picker inline, so a glitch never blocks the game log, and the play's team points still count.

**Storage** (`convex/schema/games.ts`):

```ts
scoringPlays: defineTable({
  franchiseId, seasonId, gameId,
  order: v.number(),                 // position in the game, 1-based
  period: v.number(),                // 1–4, 5 and up for overtime
  clock: v.number(),                 // seconds left in the period
  teamId: v.id("teams"),
  kind: vScoringKind,
  yards: v.optional(v.number()),
  ...playerRefFields,                // the scorer: playerId or rawName, both optional
  passer: v.optional(v.object(playerRefFields)),
  pat: v.optional(vPat),
  homeScore: v.number(), awayScore: v.number(),
  description: v.optional(v.string()), // as printed, for the review diff and the game page
})
  .index("by_gameId", ["gameId"])
  .index("by_playerId", ["playerId"])
  .index("by_seasonId_and_teamId", ["seasonId", "teamId"]),
```

Plays commit through the same `commitRows` dispatch as other row targets; the commit rewrites the game's plays as a set (idempotent per game), recomputes `games.lineScore` from them (plays win over typed quarters when both exist, and the quarter editor says so), and schedules the normal after-game refresh plus the scoring refresh below.

**Engine** `shared/stats/scoring.ts`:

- `lineScoreFromPlays(plays)`: points per period per team.
- `gameFlow(plays)`: the score after every play, lead changes, ties, largest lead per team, largest deficit overcome, the **game-winning score** (the last score that put the winner ahead for good) and who had it, time of the go-ahead score, whether the team scored first, whether the team trailed entering the fourth and won (an exact comeback, replacing the quarter-based guess in 4.7).
- `playerScoring(plays, playerId)`: touchdowns by kind and by period, fourth-quarter and overtime touchdowns, game-winning scores, longest touchdown, first touchdown (season and career), touchdowns by opponent.
- `connections(plays)`: passer-to-scorer pairs with counts and yards, per season and career ("Maye to Boutte: 31 touchdowns").
- `kicking(plays)`: field goals by distance band and by period, go-ahead and game-winning kicks, kicks in the last two minutes.
- `teamScoring(plays)`: points by period for and against, scoring plays by kind, average length of a touchdown, points off turnovers (when the kind is `int_td` or `fumble_td` only; drive data is not on the screen), fastest and latest scores.

Scoring plays also become **records** (scope `game` and `season` with the existing books): longest touchdown of each kind, most touchdowns in a period, most game-winning scores in a season and a career, most touchdowns from one connection; **milestones** (first career touchdown, game-winning score, a 50-touchdown connection); **team records** (points in a quarter, largest comeback, largest blown lead); and **splits** (performance when scoring first, when trailing at the half).

**Screens.** Game detail gets a **Scoring summary** under the score bug: plays grouped by period, each with the team logo, clock, the structured description rendered from the fields (never the raw text, which stays as a tooltip), the score after it, a PAT tag, and a tap to assign or change the player; a `ScoreWorm` chart (score margin over game time, the periods marked, touch tooltips on each play) sits beside it on desktop and above it on the phone. The player page's game log marks touchdowns with their period and clock, the Trends view gets "touchdowns by quarter" and the connection table, the Overview tile strip shows this season's game-winning scores. The stars editor suggests the player with the game-winning score.

**Reading back.** `games/scoring:byGame`, `stats/scoring:player(playerId, seasonId | career)`, `stats/scoring:team(seasonId)`, each one index; the player and team folds are bounded by games played.

 (`convex/schema/stats.ts`)

Additions only; nothing existing changes shape except as noted.

| Table | Change | Why |
|---|---|---|
| `records`, `recordBoards`, `recordPlacements`, `typedRecords` | `scope` gains `mark` and `span`; new optional fields `mark?: number`, `window?: number`, `horizon?: "career" \| "season" \| "team"`. Index stays the same with the new fields appended (`…_statKey_and_scope_and_mark_and_window`) or a second index. | Fastest-to and span lists are records lists: same holder, previous, top 20, placements and typed entries. |
| `records.top[]` entries | add `gamesToReach?`, `startGameId?`, `endGameId?`, `crossesSeasons?` | Render "in 41 games" and "Week 9 2029 to Week 3 2030". |
| `seasonPlayerStats.bestGames` | becomes `Record<stat, SeasonHigh[]>` (top three, best first); keep a `bestGame` accessor for existing readers | Full single-game lists. |
| `playerMarks` (new) | `{ franchiseId, playerId, statKey, mark, horizon, gamesToReach, seasonId, weekKey, gameId, teamId }`, indexes `by_playerId`, `by_franchiseId_and_statKey_and_mark_and_horizon` | A player's milestone timeline and the countdown card read one index; the fastest-to board is built from it. |
| `streaks` | add `longestFrom`, `longestTo`, `currentFrom` (`{ seasonId, year, weekKey }`), `seasonId?` for per-season rows | Dates on streaks. |
| `teamRecords` (new) | `{ franchiseId, statKey, scope, split, value, gameId?, seasonId?, year, opponentTeamId?, top: [...] }`, index by franchise, split, scope, stat | Team record lists. |
| `scoringPlays` (new, `convex/schema/games.ts`) | see 4.10 | Every score of every game; the source for line scores, game flow, connections and clutch scoring. |
| `milestones.kind` | add `mark`, `player_streak`, `team_record`, `first_td`, `game_winner` | Feed and acknowledge like the rest. |

Row counts stay small: marks are tens per player at most; spans and team records are top-20 boards. Everything joins the backup (`ops/backup`) and the restore map, or is rebuilt (boards) and documented as such.

---

## 6. Backend work (`convex/stats/`)

- **`refresh:afterGame`**: after `refreshPlayerStreaks` (which already holds the player's full career lines) run `reachedMarks`, `bestSpans` for every window, and the extended streaks; write `playerMarks` upserts by `(player, stat, mark, horizon)`, merge span entries into the span boards (same `mergeEntries` as `recordBoards`), and emit `mark` and `player_streak` milestones. Then team: fold the season's games for quarter stats and team records (`mergeEntries` on `teamRecords`). Budget: the same read set as today plus one write per changed board; the user team has at most about 25 players per box score.
- **`recordBuild`**: new phases `marks` and `spans` (per player page, like `players`), `teamRecords` (per season). `stats/rebuild:all` grows the same way; Settings → Data gets a "Rebuild stats" button so no step is CLI-only (see the audit).
- **Queries (all `requireOwner`, one index each)**:
  - `stats/hub:overview(seasonId)`: the tiles (record, pace, Pythagorean, top producers from the season rows, active streaks, countdowns from `careerPlayerStats` against `MARKS`, records set this season from `milestones`).
  - `stats/trends:player(playerId)`: season rows (regular and postseason) with age, plus the per-season game lines for cumulative overlays (one `by_playerId_and_seasonId` read per season, bounded by seasons with the team).
  - `stats/trends:team()`: per season record, points, differential, `teamTotals`, captured ranks; per game points and team stats for the selected seasons.
  - `stats/splits:player(playerId, seasonId | "career")` and `stats/splits:team(seasonId | "all")`.
  - `stats/marks:lists(statKey, horizon)`, `stats/spans:lists(statKey, window, split)`, `stats/teamRecords:lists(scope, split)`: boards plus typed entries, through `rankList`.
  - `stats/explorer:run(question)`: validates the question against the registries and dispatches to the right board or per-entity fold; never scans. Questions that would scan (every player's splits) are refused with a message, not approximated.
  - `players/gameLog:career(playerId, filter)`: all seasons, with threshold filters applied server-side, bounded by `MAX_PLAYER_LINES`.
- **Indexes**: `gameStatLines` gets `by_playerId` (career reads without the season fan-out) and `games` gets `by_franchiseId_and_seasonId` is already covered by `by_seasonId_and_weekKey`; `playerMarks` indexes as above.
- **Tests**: `convex-test` for the refresh (a mark reached, a span improved, a streak with dates, a team record), idempotency (recommit the same game: no duplicate marks or milestones), and a deleted or corrected game lowering a span or un-reaching a mark.

---

## 7. Screens and components

New primitives, each with a gallery specimen, phone layout from its own width, both themes, reduced motion:

| Component | Purpose |
|---|---|
| `CumulativeChart` | Step lines of running totals per game; several series (seasons, players, or a record pace as a dashed reference); touch tooltips; a marker where a mark is crossed. |
| `SeasonBars` | Grouped or stacked bars per season (points for and against, wins and losses, yards) with a rank badge row under the axis. |
| `PaceBar` | Progress to a target with the projected finish as a ghost segment and the rate needed as a caption; stacks on the phone. |
| `DeltaBadge` | Signed change with direction colour that respects `better`; used in YoY tables and tiles. |
| `SplitTable` | A `DataTable` preset: one row per split group, the same stat columns as the season table, games as the first stat, phone primaries declared per group. |
| `QuarterGrid` | 4 + OT columns of points for, against and differential with a bar per cell. |
| `MilestoneTimeline` | Vertical list of marks reached with season, week, game link and games-to-reach, newest first. |
| `ScoreWorm` | Score margin over game time from the scoring plays, periods marked, a dot per score with a touch tooltip; stacks above the summary on the phone. |
| `ScoringSummary` | Period-grouped play list with logo, clock, rendered description, score after, PAT tag and an inline player picker for rows without a scorer. |
| `QuestionBuilder` | The explorer's controls: stat picker from the registry, scope, split, window or mark, minimums, season range; emits a typed `Question` and writes it to the URL. |

Existing primitives carry the rest: `StatCard` with `trend`, `DataTable` + `statColumn`, `RankTrend`, `PointsChart`, `DivergingBars`, `Tile`/`TileStrip`, `FactChip`, `Highlight`, `RecordList`.

Per view:

- **Overview**: `TileStrip` (record, pace, differential, Pythagorean, points per game rank), three leader `StatCard`s, a `PaceBar` row for the three closest countdowns, active streak `FactChip`s, a "set this season" record list, league context ribbon. Phone: one column, tiles two-up.
- **Players**: add a `Pace` column group (toggle) and a `vs last year` toggle that turns the number cells into value plus `DeltaBadge`.
- **Team**: `SeasonBars` (results and points per season), `PointsChart` per season, `QuarterGrid`, `SplitTable` for the team, team record lists, today's `RankTrend`.
- **Trends**: a subject picker (team or a player), stat picker, `TrendChart` across seasons with `DeltaBadge`s, `CumulativeChart` overlays (this year, last year, best year, franchise record pace), rolling 5-game average line.
- **Records**: the book, scope and category segments gain `Fastest to` (with a mark picker) and `Best span` (with a window picker) and `Team`; lists render with the extra "in N games" and "from to" captions; typed entries supported where the book allows them.
- **Streaks**: two lists, Active and Longest, each with dates and links; a season filter.
- **Explorer**: `QuestionBuilder`, result as table or chart with an "open as records list" or "open player" action, URL state so a question is bookmarkable.
- **Player page**: `Pace` card during a live season, `Trends` (YoY table plus chart), `Cumulative`, `Splits` (season or career), `MilestoneTimeline`, and the new placements inside "Records and streaks". Game log gets a career toggle and threshold filters.
- **Home**: `Countdowns` card (three nearest marks across the roster, with a `PaceBar` each) and the pace line in the season header.

Phone parity, per `FEATURES.md` 9: charts fewer ticks and tap tooltips, legends as chips, tables declare primaries, the explorer's controls open in a `BottomSheet`, nothing hidden.

---

## 8. Build order

Five sprints, each demoable and each ending with the phone check, Playwright smoke tests ("… without overflow" names) and `npm run check:all` green.

**Sprint 14: scoring plays (M)**
The `scoring_plays` row target with game scope and multi-screen merge, `scoringPlays` table and commit, resolution against the game's box score with the kind-aware picker, "needs a player" on the game page, `lineScore` derived from plays, `shared/stats/scoring.ts` with unit tests, the Scoring summary and `ScoreWorm` on game detail (both themes, phone), the player game log's period and clock marks, and the scoring entries in records, milestones and team records. Done when a game's scoring summary goes from photos to a play list in review, a row with a missing name is assigned in one tap to the only receiver with a touchdown, the quarter scores fill themselves, and the game page says who had the game-winning score.

**Sprint 15: engines and storage (M)**
`ledger`, `marks`, `spans`, `pace`, `yoy`, `splits`, `quarters` (reading scoring plays where a game has them), `teamRecords`, extended `streaks` in `shared/stats` with unit tests at the current coverage bar; schema additions; `afterGame` and `recordBuild` extended; `rebuild:all` and a Settings button; `players/gameLog:career`; backup coverage. Done when a committed game sets a mark, improves a span, dates a streak and sets a team record, recommitting changes nothing, and a rebuild from scratch matches the incremental result.

**Sprint 16: hub overview, pace, trends (M)**
Overview view, pace columns and the Home pace line, Countdowns card, Trends view, player page Pace, Trends and Cumulative sections; `CumulativeChart`, `SeasonBars`, `PaceBar`, `DeltaBadge` in the gallery. Done when Home and Stats say what a season is on pace for and the player page shows a career as curves, not only rows.

**Sprint 17: records and streaks depth (M)**
Fastest-to and best-span lists in the Records book with typed entries, full single-game lists, team records, Streaks with dates and the new kinds, `MilestoneTimeline` on the player page, mark and streak milestones on Home. Done when "fastest to 1,000 yards in a season", "most TDs in any 5 games" and "most points we ever scored" are each one tap.

**Sprint 18: splits and the explorer (M)**
`SplitTable`, `QuarterGrid`, team and player splits, the Explorer with URL state, career game log filters. Done when a question with a stat, scope, split and window can be built on the phone and bookmarked.

Order rationale: scoring plays first because they are a new capture (the sooner they are captured, the more seasons have them) and the later engines read them; storage next so every later view is one read; the pace and trend views come next because they need no new storage beyond Sprint 14 and change the app most for the least code; the explorer last because it composes everything before it.

---

## 9. Questions the hub answers on day one

A checklist to test against, in the user's words:

- Fastest to 1,000 / 5,000 / 10,000 rushing yards: career, single season, with the team, in the franchise era.
- Most TDs in any 3, 5 or 10 games; the best 5-game stretch of a QB's career.
- Is he on pace for 1,500 yards? For the team record? What does he need per game from here?
- How does this season compare with last season, stat by stat, for him and for the team?
- Cumulative yards this season against his best season and against the franchise record pace.
- Home versus away, wins versus losses, division games, one-score games, by opponent: for the team and for one player.
- Points by quarter; comebacks; blown leads; record in overtime; biggest win and worst loss.
- Longest active streak of games with a touchdown, and when it started; longest ever and when it ended.
- The most points, yards, sacks and takeaways the team ever had in a game or a season.
- Every 100-yard game of a career, sorted, filtered, linked to its box score.
- How many yards from the next mark, and who on the roster is closest to one.
- Who scored the game-winner, when, and how many game-winning scores has he had; the longest touchdown of the season; how many touchdowns the QB and his top receiver have together; points by quarter for and against; the biggest comeback and the worst blown lead.

---

## 10. Out of scope and caveats

- **Other teams' players**: no per-game data beyond the games they played against us, so no pace, spans or splits for them. The league book and league stats remain the context.
- **Imported seasons** have no games: fastest-to counts them as a starting total and a game count, cumulative curves start at the franchise, and spans and splits ignore them. Every list says "franchise games only" where that applies.
- **Missing box scores** make a pace, mark or span low, never wrong in the other direction; the reconcile view's missing-game count shows next to any affected list.
- **Starts** are not captured (`gamesStarted` is never written), so no per-start rates until a target provides them.
- Snap counts and advanced stats (EPA, air yards) are not in Madden's screens; out of scope until a screen provides them. Drive data (starts, plays, time of possession per drive) is not on the scoring summary either, so drive charts wait for a screen that shows them.

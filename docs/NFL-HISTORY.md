# Real NFL history: source and import

Decision record for `FEATURES.md` 4.8 (Sprint 4). Franchises are new; every finished real NFL season before a franchise's first season is imported, and everything after is captured as it is played.

## Decision

**History comes from nflverse. ESPN supplies faces and logos.**

| Need | Source | File |
|---|---|---|
| Records, division rank, seed, points | nfldata `standings.csv` (nflverse) | `raw.githubusercontent.com/nflverse/nfldata/master/data/standings.csv` |
| Playoff results, which seasons are finished | nflverse schedules | `releases/download/schedules/games.csv` |
| Players: bio, draft slot, ESPN id | nflverse players | `releases/download/players/players.csv` |
| Season totals, regular season and playoffs | nflverse player stats | `releases/download/stats_player/stats_player_{reg,post}_{year}.csv` |
| Draft history | nflverse draft picks | `releases/download/draft_picks/draft_picks.csv` |
| The franchise's first-season rosters | nflverse rosters | `releases/download/rosters/roster_{year}.csv` |
| Headshots, team logos, player search and bios | ESPN site API and CDN | `site.web.api.espn.com`, `a.espncdn.com` |

Release files live under `https://github.com/nflverse/nflverse-data/releases/download/`. URLs are declared once in `shared/history/nflverse.ts`.

### Why nflverse

- Complete, consistent and documented: every team and season in one file per kind, with stable player ids (`gsis_id`) that tie stats, rosters, the draft and the player table together.
- `players.csv` carries each player's ESPN id, so imported players arrive already matched to their ESPN headshot with no name guessing.
- Plain CSV over HTTPS, no key, no rate limit worth noting. The whole import is about 50 MB of downloads.
- The ESPN site API has no bulk history: rebuilding 24 seasons of standings and season totals from it would mean thousands of per-team and per-player calls against an unofficial API. It stays for what it does well: images, search and single-player bios.

### Coverage

- **Seasons from 2002**, the first year of today's 32 teams and eight divisions. Earlier standings would not line up with the divisions the app models. Titles before 2002 can still be added by hand in the trophy room.
- **Only finished seasons**: a season is imported once its Super Bowl is in the schedule file. Playoff results come from the playoff games, not the standings file, which lags a season behind on them.
- **Players**: everyone whose last season is 2002 or later, plus anyone on a roster for the franchise's first season (about 15,000).
- **Season totals**: every stat the registry declares that nflverse publishes (`shared/history/nflverseStats.ts` maps columns to registry keys). Longest plays, drops, broken tackles and return touchdowns are not published, so imported seasons leave them blank. A season is attributed to the player's last team that year.
- **Draft**: every pick from 2002 through the franchise's first draft.
- **First-season rosters**: all 32 teams' real rosters for the first season (or the latest published before it), so box scores resolve names against real players from game one.

## How it runs

- Franchise setup starts the import (`history/importJob.startImport`). Settings shows progress and refreshes it; `npx convex run history/importJob:restart` starts it from the CLI for a franchise that predates it.
- A chain of scheduled action steps (`history/nflverseImport.runStep`): seasons and standings, players, one step per season of stats, the draft, rosters, career totals, then logos and the user team's headshots. Each step fetches, parses with `shared/history`, writes in batches of 250 through internal mutations, and schedules the next. The job row (`historyImports`) holds the plan, progress, counts and any error.
- Every write is an upsert keyed on the nflverse id (players), season and team (standings), player, season and split (season totals) or season and pick (draft), so a refresh rewrites the same rows. A run counter stops steps from an older run once a new one starts.
- A player the franchise already captured from a box score under the same name is adopted rather than duplicated when the import finds him on a first-season roster. The franchise's own roster entries are never overwritten.
- Runs in the default Convex runtime: the CSV reader streams, so `players.csv` parses in about 11 MB. A full import took 76 seconds on a local backend.

## How it reads

- Imported seasons are ordinary `seasons` rows with `year < franchise.startYear`; `isPreFranchise` is the one test for "real NFL history". The season switcher, schedule, roster, stats, history grids and the player page mark them.
- Imported totals are `seasonPlayerStats` rows with `source: "import"`. Career rows add them to log-derived seasons. Records, leaders, streaks and milestones count only log-derived rows of the user team, so real history never mixes into franchise records.
- Trophies of imported seasons are derived from their records like franchise ones, and count as history.

## ESPN

- Headshots show ESPN's CDN image until cached; the import caches the user team's first roster, and a player page caches its player the first time it opens.
- Team logos are cached into storage once and served to every `TeamLogo` through one query.
- Players without an ESPN id (captured names the import did not adopt, created players) can be matched from the player page or in bulk from the roster; confirming stores the id, fills missing bio and caches the photo. Fictional players get a monogram card.

## Testing

`shared/history/nflverseSample.ts` is a trimmed slice of the real files (2024 and 2025). Unit tests parse it, the Convex test runs the whole import chain with `fetch` stubbed to serve it, and the sample franchise (`dev/fixtures:seedFixtures`) loads it through the same writes, so CI covers the import offline.

# Real NFL history: source and import

Decision record for `FEATURES.md` 4.8 (Sprint 4). Franchises are new; every finished real NFL season before a franchise's first season is imported, and everything after is captured as it is played.

## Decision

**History comes from nflverse. ESPN supplies faces and logos.**

| Need | Source | File |
|---|---|---|
| Records, division rank, seed, points (2002 on) | nfldata `standings.csv` (nflverse) | `raw.githubusercontent.com/nflverse/nfldata/master/data/standings.csv` |
| Records, division rank, seed, points (1999–2001) | derived from nflverse schedules | `releases/download/schedules/games.csv` |
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

- **Seasons from 1999**, the first year nflverse publishes schedules and player season totals (`NFLVERSE_FIRST_YEAR`). Nothing earlier is in nflverse; see "Before 1999" below. Titles before 1999 can still be added by hand in the trophy room.
- **1999–2001 standings are derived from the schedule** (`shared/history/eraStandings.ts`), because nfldata's standings file starts in 2002. Records and points come from the regular-season games. Seeds come from who actually played in the playoffs (`eraSeeds.ts`): the two teams that first play in the divisional round had byes and are seeds 1 and 2; seed 1 is the one that hosted the lowest seed left; wild card hosts are seed 3 (the winner of the division with no bye team) and seed 4; seed 3 hosted 6 and seed 4 hosted 5. Division winners are the division's team seeded 1–3; the rest follow by win percentage, a playoff team ahead of a non-playoff team on the same record, then record between the tied teams, division record, point differential and abbreviation. That last part stands in for the NFL tiebreakers, so a non-playoff team's rank on a tied record can differ from the official one; records, seeds, division winners and playoff results match the real seasons (tested against 1999–2001).
- **The era's divisions**: 1999–2001 had 31 teams (no Houston) in six divisions: AFC East (BUF, IND, MIA, NE, NYJ), AFC Central (BAL, CIN, CLE, JAX, PIT, TEN), AFC West (DEN, KC, OAK, SD, SEA), NFC East (ARI, DAL, NYG, PHI, WAS), NFC Central (CHI, DET, GB, MIN, TB), NFC West (ATL, CAR, NO, SF, STL), verified in `games.csv` (every pair met twice as division games). Nothing is stored for it: `shared/league/alignment.ts` gives a team's conference and division for a year, and standings, the bracket and the all-time table read it, so those seasons show Seattle in the AFC West and Tampa Bay in the NFC Central, with three divisions a conference. Old abbreviations (OAK, SD, SDG, STL, LA, LVR) resolve to today's teams through `resolveTeamAbbr`.
- **Only finished seasons**: a season is imported once its Super Bowl is in the schedule file. Playoff results come from the playoff games, not the standings file, which lags a season behind on them.
- **Players**: everyone whose last season is 1999 or later, plus anyone on a roster for the franchise's first season (about 16,500).
- **Season totals**: every stat the registry declares that nflverse publishes (`shared/history/nflverseStats.ts` maps columns to registry keys). Longest plays, drops, broken tackles and return touchdowns are not published, so imported seasons leave them blank. A season is attributed to the player's last team that year.
- **Draft**: every pick from 1999 through the franchise's first draft.
- **First-season rosters**: all 32 teams' real rosters for the first season (or the latest published before it), so box scores resolve names against real players from game one.

## How it runs

- Franchise setup starts the import (`history/importJob.startImport`). Settings shows progress and refreshes it; `npx convex run history/importJob:restart` starts it from the CLI for a franchise that predates it.
- A chain of scheduled action steps (`history/nflverseImport.runStep`): seasons and standings, players, one step per season of stats, the draft, rosters, career totals, then logos and the user team's headshots. Each step fetches, parses with `shared/history`, writes in batches of 250 through internal mutations, and schedules the next. The job row (`historyImports`) holds the plan, progress, counts and any error.
- Every write is an upsert keyed on the nflverse id (players), season and team (standings), player, season and split (season totals) or season and pick (draft), so a refresh rewrites the same rows. A run counter stops steps from an older run once a new one starts.
- A player the franchise already captured from a box score under the same name is adopted rather than duplicated when the import finds him on a first-season roster. The franchise's own roster entries are never overwritten.
- Runs in the default Convex runtime: the CSV reader streams, so `players.csv` parses in about 11 MB. A full import took 76 seconds on a local backend.
- **Earlier years for a franchise imported before coverage reached 1999** (its job says `firstYear: 2002`): Settings → Real NFL history offers "Add 1999–2001", or from the CLI `npx convex run history/importJob:importEarlierYears` (add `--prod` for production). It plans only `seasons:1999-2001`, `players:1999-2001` (players whose careers ended in those years; the older import kept everyone later), `stats:1999` to `stats:2001`, `draft:1999-2001` and `careers`, through the same upserts. Rosters, media and the seasons already imported are not touched; counts keep adding up, the job's first year moves to 1999 and its last year stays. It returns `started`, `running` or `up_to_date`. A full refresh afterwards rewrites the same rows.

## How it reads

- Imported seasons are ordinary `seasons` rows with `year < franchise.startYear`; `isPreFranchise` is the one test for "real NFL history". The season switcher, schedule, roster, stats, history grids and the player page mark them.
- Imported totals are `seasonPlayerStats` rows with `source: "import"`. Career rows add them to log-derived seasons. Records, leaders, streaks and milestones count only log-derived rows of the user team, so real history never mixes into franchise records.
- Trophies of imported seasons are derived from their records like franchise ones, and count as history.

## ESPN

- Headshots show ESPN's CDN image until cached; the import caches the user team's first roster, and a player page caches its player the first time it opens.
- Team logos are cached into storage once and served to every `TeamLogo` through one query.
- Players without an ESPN id (captured names the import did not adopt, created players) can be matched from the player page or in bulk from the roster; confirming stores the id, fills missing bio and caches the photo. Fictional players get a monogram card.
- Matching searches the NFL and college football. A created player in a real draft class is a current college prospect, so ESPN has his school, class, size and college headshot; the player keeps `espnLeague: "college"` so his photo comes from the college CDN path. An athlete has one ESPN id from college into the NFL, so a prospect's match carries over when he is drafted.
- Candidates rank by exact name, then the player's school, position group and NFL team (`shared/players/espnMatch.ts`). The bulk roster match suggests only an exact name that the player's school and position agree with, because generated Madden names often have a real namesake somewhere; everything else stays a choice on the player page. ESPN's college coverage is strongest for FBS rosters and has no stats for us to import.

## Testing

`shared/history/nflverseSample.ts` is a trimmed slice of the real files (2024 and 2025). Unit tests parse it, the Convex test runs the whole import chain with `fetch` stubbed to serve it, and the sample franchise (`dev/fixtures:seedFixtures`) loads it through the same writes, so CI covers the import offline.

`shared/history/nflverseEraSample.ts` holds every real 1999–2001 game (compact, one line per week) and a few players, totals and picks of the era. The derived standings are tested against the real outcomes (2001 Patriots win the AFC East on a tie with Miami and Super Bowl XXXVI as the 2 seed; 1999 Rams win as the NFC's 1 seed; 2000 Ravens win as a wild card), and `convex/history/importEarlier.test.ts` runs the earlier-years import end to end and checks it is idempotent. The sample franchise still loads only 2024–2025.

## Before 1999 (not built)

nflverse has nothing earlier (`stats_player_reg_1998.csv` is a 404, `games.csv` and `standings.csv` start in 1999 and 2002). Checked October 2026:

| Source | What it gives | Effort | Caveats |
|---|---|---|---|
| ESPN site API (unofficial, no key) | Standings: one call per season, `apis/v2/sports/football/nfl/standings?season=Y` (1970 and 1985 list every team at the top level; the 1990s nest them under the two conferences); W-L-T and points, no divisions or seeds. Scores: `scoreboard?dates=YYYYMMDD` returns games from 1970 on; `summary?event=id` has a box score with player passing, rushing, receiving, fumbles, defense and interceptions. | Standings only: about 30 calls for 1970–1998. Player season totals: one scoreboard call per game day plus one summary per game, roughly 230 calls a season, about 6,700 for 1970–1998, summed into season totals ourselves. | Unofficial and undocumented; it can change or throttle. Players come with ESPN athlete ids, not nflverse `gsis_id`, so they would match imported players through the ESPN id in `players.csv` (missing for many older players) or by name. Playoff rounds and seeds would be derived from the playoff games as for 1999–2001. Box score completeness for the 1970s is unverified beyond one game per season sampled. |
| Pro Football Reference (Sports Reference) | Everything back to 1920: standings with divisions, playoff seeds, player season totals, draft. | Scraping: 20 requests a minute at most, no API; a few hundred pages per decade for standings and team pages. | Their terms forbid automated access that hurts the site and building a competing data store, and their licences forbid offering the data as a download; reuse of individual pages with credit is welcomed. A personal, rate-limited, one-off pull is a grey area; bulk import is not something to build without permission. |
| FiveThirtyEight `nfl-elo` (GitHub `fivethirtyeight/data`, CC BY 4.0 by the repo's licence as reported, unverified for this folder) | Every game since 1920 with date, season, teams, scores and a playoff flag; no players. Standings, playoff results and champions could be derived the same way as 1999–2001. | One CSV, small. Needs per-era alignment tables (divisions changed in 1950, 1961, 1967, 1970, 1976–77, 1995, 1999) and per-era playoff formats (a title game to 1966, 4 teams 1967–69, 8 in 1970–77, 10 in 1978–89, 12 in 1990–2019) for seeds. | No longer updated since 538 closed in 2023, which does not matter for old seasons. Download from this machine failed during the check, so the file was not inspected. |
| Kaggle "NFL scores and betting data" (spreadspoke) | Games since 1966 with scores, plus betting lines and weather; no players. | One CSV; same derivation as above. | Kaggle account needed to download; licence not confirmed. |

Shared caveats: the 1970 AFL–NFL merger (before it, two leagues and their own champions; the Super Bowl starts with the 1966 season); strike seasons (1982 had nine games and a sixteen-team playoff with no divisions counted; 1987 had three weeks of replacement games); ties in every era; teams that moved or changed names (Colts, Oilers/Titans, Cardinals, Rams, Raiders twice, the original Browns becoming the Ravens in 1996 while Cleveland kept the Browns' history), which `resolveTeamAbbr` and the alignment tables would need per era; and Houston has no team 1997–2001. The app's alignment model (`alignmentFor`) extends to earlier eras by adding tables; seeds before 1990 would need their own derivation since byes and wild card counts differ. Recommendation: standings and playoff results back to 1970 from ESPN's standings plus the 538 or ESPN game list is a small job (one era table per realignment); player season totals before 1999 are only practical from ESPN box scores (thousands of calls, matching by ESPN id or name) or with Sports Reference's permission.

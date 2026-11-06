# Reading a Madden franchise save

`npm run export:madden -- <CAREER file> [--out <folder>]` reads a Madden 27 PC franchise save (the
`CAREER-*` file in `Documents/Madden NFL 27/saves`) and writes what it holds in the app's own
terms: the stat registry's keys, the app's week keys, team abbreviations, positions, dev traits
and award types. It only reads the save. Nothing is written to any backend; the files are what
the app's existing import paths take.

The save is EA's `FBCHUNKS` container with a zlib stream of about 2,600 tables. The community
parser [`madden-franchise`](https://www.npmjs.com/package/madden-franchise) (a dev dependency)
decodes it with the bundled Madden 27 schema; `scripts/madden-save/` turns the tables that
matter into the export.

## What comes out

`<save>-export/` next to the save, or `--out`:

| Path                                | Content                                                                                                                                                                                 | Goes into the app as                                                                                                             |
| ----------------------------------- | --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------- | -------------------------------------------------------------------------------------------------------------------------------- |
| `madden-export.json`                | Everything below in one bundle (`scripts/madden-save/types.ts`), plus the user team, the season and the week about to be played                                                         | Reference; a future "import from save" path reads this                                                                           |
| `games/<year>/<week>-<away>-at-<home>.json` | One game log per played game still in the save: score, line score, weather, every player's line (registry keys), both teams' stats (team registry keys), the scoring summary | The full game log target, once it can take a file; today the numbers are typed into Enter manually                               |
| `csv/schedule/<year>.csv`           | Every game of the season with scores once played                                                                                                                                        | Inbox → Schedule / scores → CSV (one set for the whole season)                                                                   |
| `csv/standings/<year>.csv`          | This season's records, division rank, seed, points                                                                                                                                      | Standings → CSV                                                                                                                  |
| `csv/team-history/<team>.csv`       | Each team's finished franchise seasons: record, division title, playoff result where the save says                                                                                      | Team history → CSV (the user team's); other teams' rows are for reference                                                        |
| `csv/rosters/<year>/<team>.csv`     | A team's roster as of the save: position, number, OVR, age, years pro, dev trait, status                                                                                                | Roster page → CSV, with the team picked in the editor                                                                            |
| `csv/season-stats/<year>.csv`       | Every player's season totals per team, every category in one row                                                                                                                        | Season stats → CSV (whole league; the user team's rows reconcile against the game logs)                                          |
| `csv/awards/weekly/<year>-<week>.csv` | Offensive and defensive players of the week per conference                                                                                                                            | Weekly awards → CSV, filed under that week                                                                                       |
| `csv/awards/yearly/<year>.csv`      | MVP, players and rookies of the year, the position awards, Super Bowl MVP, Coach of the Year                                                                                            | Yearly awards → CSV                                                                                                              |
| `csv/draft/<year>.csv`              | Each franchise draft: round, pick, team, player, position, OVR and age as of the save                                                                                                   | Draft results → CSV                                                                                                              |
| `csv/injuries/<year>.csv`           | Everyone injured as of the save, with the weeks out and IR                                                                                                                              | Injury report → CSV                                                                                                              |

Every CSV's header uses the target's field keys, so the app's CSV import matches the columns
without any renaming.

## What the save keeps, and what it does not

- **Box scores exist for the season in progress only.** Madden keeps per-game player stats
  (`GameOffensiveStats`, `GameDefensiveStats`, `GameKickingStats` and the kick/punt-return twins,
  linked from each player's `GameStats` array) for the current season, and a handful of the user
  team's memorable games from earlier seasons keep their team stats. Earlier seasons survive as
  season totals per player (`SeasonOffensiveStats` and friends, keyed by season and team) and as
  each team's record and titles (`Team.TeamSeasonStats`). Export after every week played and the
  franchise never loses a game log; a season already finished can only be loaded as totals.
- **The scoring summary names no scorer.** `ScoringSummary` rows give the quarter, the seconds
  left, the running score and the try after a touchdown; the player snapshots on them are the
  game's final box score, not per play. The export files each score with its kind where the
  points settle it (field goal, safety, the try) and `other` with a description for a touchdown,
  so the app's review can pick the scorer from the box score's unclaimed scorers.
- **Weekly awards carry no season.** Last season's rows stay in `PlayerAward` until this
  season's week overwrites them, so early in a season the same week has two rows per award. The
  export dates them by where they sit in the table (last season's rows are a contiguous block)
  and marks such rows `seasonGuessed`.
- **Yearly awards for seasons before the franchise** (real 2017 to 2024 winners on today's
  rosters) are in the JSON for reference and left out of the CSVs.
- **Colleges, birthdates and contracts** point into the game's static data or are encoded in ways
  this export does not decode. Ages are exported (the app anchors a player's age to the season),
  heights in inches and weights in pounds are.
- **Stats the save has no column for:** sack yards lost, targets, two-point conversions per player.
  Tackles are solo tackles; a half sack counts as 0.5. Total yards is passing plus rushing, as the
  app counts it, not Madden's return-inclusive total.
- **Positions** are the player's position as of the save (`LE`/`RE` become `LEDG`/`REDG`,
  `LOLB`/`ROLB` become `SAM`/`WILL` through the app's own aliases). Dev traits map Madden 27's
  Normal / Impact / Star / Elite onto normal / star / superstar / xfactor.
- **Draft picks** are rebuilt from each player's draft columns, so a cut or retired draftee is
  still listed; a pick's OVR and age are today's, not draft day's. The draft class waiting to be
  drafted is not in the rosters.

## Checking an export

`Drake Maye`'s current-season totals in `csv/season-stats/<year>.csv` should equal the sum of his
lines across `games/<year>/w*.json`; the exporter's own tests cover the stat mapping, the
calendar and the CSV format (`scripts/madden-save/*.test.ts`), and `npm run check` runs them.

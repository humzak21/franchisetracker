/**
 * JSON schemas the vision model must answer with, generated from the stat registries so a new
 * stat is extractable the moment it is registered. Strict-mode friendly: every property is
 * required and nullable instead of optional, and no additional properties are allowed.
 */
import {
  STAT_CATEGORIES,
  RAW_STATS,
  extractionField,
  type RawStatKey,
  type StatCategory,
} from "../stats/registry";
import { TEAM_STAT_KEYS, TEAM_STATS, type TeamStatKey } from "../stats/teamRegistry";

export type JsonSchema = {
  type?: string | string[];
  description?: string;
  properties?: Record<string, JsonSchema>;
  required?: string[];
  additionalProperties?: boolean;
  items?: JsonSchema;
  enum?: readonly (string | null)[];
};

const nullable = (type: string, description?: string): JsonSchema => ({ type: [type, "null"], description });

function object(properties: Record<string, JsonSchema>, description?: string): JsonSchema {
  return {
    type: "object",
    description,
    properties,
    required: Object.keys(properties),
    additionalProperties: false,
  };
}

/** Fields every extracted row carries so review can show what the model was unsure of. */
const rowMeta = {
  confidence: { type: "number", description: "0 to 1: how sure you are this whole row is read correctly." },
  unclear_fields: {
    type: "array",
    items: { type: "string" },
    description: "Field names in this row that were blurry, cut off or guessed.",
  },
} satisfies Record<string, JsonSchema>;

const gameHeader = {
  home_team: nullable("string", "Home team as printed (abbreviation or name)."),
  away_team: nullable("string", "Away team as printed (abbreviation or name)."),
  home_score: nullable("integer", "Final home score."),
  away_score: nullable("integer", "Final away score."),
  overtime: nullable("boolean", "True when the game went to overtime."),
  home_quarters: {
    type: "array",
    items: { type: "integer" },
    description: "Home points per quarter, OT last.",
  },
  away_quarters: {
    type: "array",
    items: { type: "integer" },
    description: "Away points per quarter, OT last.",
  },
} satisfies Record<string, JsonSchema>;

export function rawKeysInCategory(category: StatCategory): RawStatKey[] {
  return (Object.keys(RAW_STATS) as RawStatKey[]).filter((key) => RAW_STATS[key].category === category);
}

/** Box score: one array per stat category, the way Madden's player stats screens are split. */
export function boxScoreSchema(): JsonSchema {
  const categories = Object.fromEntries(
    STAT_CATEGORIES.map((category) => {
      const stats = Object.fromEntries(
        rawKeysInCategory(category).map((key) => [
          extractionField(key),
          nullable(RAW_STATS[key].format === "half" ? "number" : "integer", RAW_STATS[key].label),
        ]),
      );
      const row = object({
        team: nullable("string", "The player's team as printed, or null if the screen does not say."),
        name: { type: "string", description: "Player name exactly as printed." },
        position: nullable("string", "Position as printed (QB, HB, WR, LEDGE, ...), or null."),
        ...stats,
        ...rowMeta,
      });
      return [category, { type: "array", items: row }];
    }),
  );
  return object({ ...gameHeader, ...categories });
}

/** The field name the model uses for a team stat; possession is read as a clock string. */
export function teamExtractionField(key: TeamStatKey): string {
  return key === "possessionSec" ? "time_of_possession" : extractionField(key);
}

export function teamStatsSchema(): JsonSchema {
  const stats = Object.fromEntries(
    TEAM_STAT_KEYS.map((key) => [
      teamExtractionField(key),
      key === "possessionSec"
        ? nullable("string", "Time of possession as m:ss")
        : nullable("integer", TEAM_STATS[key].label),
    ]),
  );
  const team = object({ team: nullable("string", "Team as printed."), ...stats, ...rowMeta });
  return object({ ...gameHeader, teams: { type: "array", items: team } });
}

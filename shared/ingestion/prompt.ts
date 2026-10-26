/** Prompt text for an extraction: shared rules, the target's instructions, context and past corrections. */
import { INGESTION_TARGETS, type TargetKey } from "./targets";

export type PromptContext = {
  /** "2026 season, Week 3" when known. */
  when?: string;
  /** "NE (New England Patriots)": the franchise's team, usually one side of the game. */
  userTeam: string;
  /** The opponent when the upload was tagged with a game. */
  opponent?: string;
};

export type PastCorrection = {
  fieldPath: string;
  extracted: string | number | boolean | null;
  corrected: string | number | boolean | null;
};

const RULES = [
  "You read screenshots and photos of the video game Madden NFL and return exactly the JSON the schema asks for.",
  "Copy numbers exactly as shown; never compute, estimate or fill in a value that is not visible: use null.",
  'Copy names exactly as printed, including initials ("D. Maye").',
  "Photos of a TV can be skewed, glared or blurry: read carefully, and list any field you had to guess in that row's unclear_fields with a lower confidence.",
].join("\n");

/** At most this many corrections go into a prompt, newest first, to keep prompts small. */
export const MAX_FEW_SHOT = 12;

export function buildPrompt(
  target: TargetKey,
  context: PromptContext,
  corrections: readonly PastCorrection[],
) {
  const lines = [INGESTION_TARGETS[target].instructions, "", `The user's team is ${context.userTeam}.`];
  if (context.opponent) lines.push(`The opponent is ${context.opponent}.`);
  if (context.when) lines.push(`This is from the ${context.when}.`);
  if (corrections.length > 0) {
    lines.push("", "Earlier extractions of this screen were corrected by the user. Avoid the same mistakes:");
    for (const c of corrections.slice(0, MAX_FEW_SHOT)) {
      lines.push(
        `- ${c.fieldPath}: read as ${JSON.stringify(c.extracted)}, actually ${JSON.stringify(c.corrected)}`,
      );
    }
  }
  return { system: RULES, user: lines.join("\n") };
}

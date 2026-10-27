/**
 * Reading a big screenshot set in pieces. Providers cap what one request may carry (Google
 * rejects more than 30 MB of downloaded images), so a set read together is sent a few
 * screenshots at a time and the answers are merged back into one before normalizing.
 */
import { isObj, type Obj } from "./normalize";

/** Screenshots per request: few enough that full-size phone PNGs stay well under the caps. */
export const MAX_CHUNK_IMAGES = 3;
/** Image bytes per request, leaving room under Google's 30 MB cap. */
export const MAX_CHUNK_BYTES = 20 * 1024 * 1024;

/**
 * Splits images, in order, into requests of at most `MAX_CHUNK_IMAGES` and `MAX_CHUNK_BYTES`.
 * An image bigger than the byte budget on its own still gets a request of its own.
 */
export function chunkImages<T extends { size: number }>(images: readonly T[]): T[][] {
  const chunks: T[][] = [];
  let current: T[] = [];
  let bytes = 0;
  for (const image of images) {
    if (current.length > 0 && (current.length === MAX_CHUNK_IMAGES || bytes + image.size > MAX_CHUNK_BYTES)) {
      chunks.push(current);
      current = [];
      bytes = 0;
    }
    current.push(image);
    bytes += image.size;
  }
  if (current.length > 0) chunks.push(current);
  return chunks;
}

/** Whether a chunk's answer actually read a value: null, false and [] mean "not on my screens". */
const seen = (value: unknown) =>
  value !== null && value !== undefined && value !== false && !(Array.isArray(value) && value.length === 0);

const isRowList = (value: unknown): value is Obj[] => Array.isArray(value) && value.some(isObj);

/**
 * Merges the model's answers for the chunks of one set into one answer, as if it had read every
 * screenshot at once. Lists of rows (a stat tab's players) are joined, so a player on two
 * screens is merged and checked by the normal box score rules. Any other field (score, teams,
 * quarters, overtime) takes the value the chunks that saw it agree on most, earliest first.
 */
export function mergeAnswers(answers: readonly unknown[]): unknown {
  const parts = answers.filter(isObj);
  if (parts.length <= 1) return answers[0];
  const merged: Obj = {};
  for (const key of new Set(parts.flatMap((p) => Object.keys(p)))) {
    const values = parts.map((p) => p[key]);
    if (values.some(isRowList)) {
      merged[key] = values.flatMap((v) => (Array.isArray(v) ? v : []));
      continue;
    }
    const counts = new Map<string, { value: unknown; n: number }>();
    for (const value of values.filter(seen)) {
      const id = JSON.stringify(value);
      const entry = counts.get(id) ?? { value, n: 0 };
      entry.n += 1;
      counts.set(id, entry);
    }
    let best: { value: unknown; n: number } | undefined;
    for (const entry of counts.values()) if (!best || entry.n > best.n) best = entry;
    merged[key] = best ? best.value : values[0];
  }
  return merged;
}

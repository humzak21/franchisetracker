/**
 * How well a printed player name ("D. Maye", "Maye", "Stefon Digs") fits a known name. Pure; the
 * roster context that decides between close names lives in `./playerMatch`.
 */

const SUFFIXES = new Set(["jr", "sr", "ii", "iii", "iv", "v"]);

/** Lowercase words without punctuation or generational suffixes: "D.J. Moore Jr." → ["dj", "moore"]. */
export function nameTokens(name: string): string[] {
  return name
    .toLowerCase()
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/(\w)\.(?=\w\.)/g, "$1")
    .replace(/[^a-z\s'-]/g, " ")
    .replace(/['-]/g, "")
    .split(/\s+/)
    .filter((t) => t.length > 0 && !SUFFIXES.has(t));
}

/** "M.Hawkins" or "M. Hawkins": a first initial, the way list screens print names. */
export function isShortened(name: string): boolean {
  return /^\s*\p{L}\.\s*\S/u.test(name);
}

/** The fuller of two printings of one name: a list's "M.Hawkins" gives way to "Marcellous Hawkins". */
export function fullerName(kept: string | null, other: string | null): string | null {
  if (!kept || !other) return kept ?? other;
  return isShortened(kept) && !isShortened(other) ? other : kept;
}

/** Jaro-Winkler similarity in [0, 1]. */
export function similarity(a: string, b: string): number {
  if (a === b) return 1;
  if (a.length === 0 || b.length === 0) return 0;
  const window = Math.max(0, Math.floor(Math.max(a.length, b.length) / 2) - 1);
  const aMatched = new Array<boolean>(a.length).fill(false);
  const bMatched = new Array<boolean>(b.length).fill(false);
  let matches = 0;
  for (let i = 0; i < a.length; i++) {
    for (let j = Math.max(0, i - window); j < Math.min(b.length, i + window + 1); j++) {
      if (bMatched[j] || a[i] !== b[j]) continue;
      aMatched[i] = bMatched[j] = true;
      matches++;
      break;
    }
  }
  if (matches === 0) return 0;
  let transpositions = 0;
  for (let i = 0, j = 0; i < a.length; i++) {
    if (!aMatched[i]) continue;
    while (!bMatched[j]) j++;
    if (a[i] !== b[j]) transpositions++;
    j++;
  }
  const m = matches;
  const jaro = (m / a.length + m / b.length + (m - transpositions / 2) / m) / 3;
  let prefix = 0;
  while (prefix < 4 && a[prefix] === b[prefix]) prefix++;
  return jaro + prefix * 0.1 * (1 - jaro);
}

/** Edits (insert, delete, substitute, swap two neighbours) from one word to the other. */
export function editDistance(a: string, b: string): number {
  const rows = Array.from({ length: a.length + 1 }, (_, i) => [i, ...new Array<number>(b.length).fill(0)]);
  for (let j = 1; j <= b.length; j++) rows[0]![j] = j;
  for (let i = 1; i <= a.length; i++) {
    const row = rows[i]!;
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      row[j] = Math.min(rows[i - 1]![j]! + 1, row[j - 1]! + 1, rows[i - 1]![j - 1]! + cost);
      if (i > 1 && j > 1 && a[i - 1] === b[j - 2] && a[i - 2] === b[j - 1])
        row[j] = Math.min(row[j]!, rows[i - 2]![j - 2]! + 1);
    }
  }
  return rows[a.length]![b.length]!;
}

const glyphs = (word: string) => word.replace(/rn/g, "m").replace(/vv/g, "w").replace(/cl/g, "d");

/**
 * How far a printed surname is from a known one. Only the slips a screen read makes count as the
 * same surname: one wrong letter, two in a long name, or a long name cut short. Anything further
 * is a different family: "Stafford" is not a misread "Stewart", however many letters they share.
 */
export function surnameFit(printed: string, known: string): number {
  if (!printed || !known) return 0;
  if (printed === known) return 1;
  if (printed.length >= 6 && known.startsWith(printed)) return 0.94;
  // "Comer" for "Corner": letter pairs a screen read blurs into one count as a single slip.
  const distance = Math.min(
    editDistance(printed, known),
    Math.max(1, editDistance(glyphs(printed), glyphs(known))),
  );
  const length = Math.max(printed.length, known.length);
  if (distance === 1 && length >= 4) return 0.92;
  if (distance === 2 && length >= 8) return 0.82;
  return similarity(printed, known) * 0.6;
}

/** Below this the surnames differ, and the first name cannot make up for it. */
const SAME_SURNAME = 0.8;
const DIFFERENT_SURNAME_CAP = 0.5;

/** How well a printed first name or initials fit any of the names a player goes by. */
function firstFit(printed: string, firsts: readonly string[]): number {
  let best = 0;
  for (const first of firsts) {
    if (!first) continue;
    let fit: number;
    if (printed === first) fit = 1;
    else if (printed.length <= 2 || first.length <= 2) {
      // Initials on either side: "D" for Drake, "DJ" for D.J., a stored "M." for Marcellous.
      const [short, long] = printed.length <= first.length ? [printed, first] : [first, printed];
      fit = long.startsWith(short) ? 1 : short[0] === long[0] ? 0.5 : 0.15;
    } else if (
      Math.min(printed.length, first.length) >= 3 &&
      (first.startsWith(printed) || printed.startsWith(first))
    )
      fit = 0.95; // Matt for Matthew, Pat for Patrick.
    else {
      const sim = similarity(printed, first);
      fit = sim >= 0.88 ? sim : sim * 0.5;
    }
    best = Math.max(best, fit);
  }
  return best;
}

/** One way a player's name reads: the first names they go by, their surname, and the whole. */
export type NameForm = { firsts: string[]; last: string; full: string };

/**
 * A name's forms. A display name and a legal name can differ ("Matthew Stafford" is John Matthew
 * Stafford in the league files), and a nickname in the middle counts as a first name too.
 */
export function nameForms(name: string, lastName: string | null = null): NameForm {
  const tokens = nameTokens(name);
  const full = tokens.join(" ");
  const surname = lastName ? nameTokens(lastName) : [];
  const ends =
    surname.length > 0 &&
    surname.length < tokens.length &&
    surname.every((t, i) => tokens[tokens.length - surname.length + i] === t);
  // "Z.Flowers" or "A.St. Brown": the first word is the initial, everything after it the surname.
  const cut = ends ? tokens.length - surname.length : isShortened(name) ? 1 : tokens.length - 1;
  const firstTokens = tokens.slice(0, Math.max(0, cut));
  const last = tokens.slice(Math.max(0, cut)).join("");
  const firsts = firstTokens.length > 1 ? [firstTokens.join(""), ...firstTokens] : firstTokens;
  return { firsts, last, full };
}

/** A name fit: the score, and whether the surnames agree or only look alike. */
export type NameFit = { score: number; sameSurname: boolean };

/** How well a printed name fits one form of a known name, in [0, 1]. */
function formFit(printed: string, form: NameForm): NameFit {
  const tokens = nameTokens(printed);
  if (tokens.length === 0 || !form.last) return { score: 0, sameSurname: false };
  if (tokens.join(" ") === form.full || tokens.join("") === form.full.replace(/ /g, ""))
    return { score: 1, sameSurname: true };
  if (tokens.length === 1) {
    const last = surnameFit(tokens[0]!, form.last);
    return { score: last * 0.85, sameSurname: last >= SAME_SURNAME };
  }
  // A shortened printing splits after its initial; a full one could split anywhere ("Amon Ra St Brown").
  const cuts = isShortened(printed) ? [1] : Array.from({ length: tokens.length - 1 }, (_, i) => i + 1);
  let best: NameFit = { score: 0, sameSurname: false };
  for (const cut of cuts) {
    const first = tokens.slice(0, cut).join("");
    const surname = tokens.slice(cut).join("");
    const fit = surnameFit(surname, form.last);
    const sameSurname = fit >= SAME_SURNAME;
    // A different surname keeps its raw likeness, so a badly misread teammate can still be offered.
    const last = sameSurname ? fit : similarity(surname, form.last);
    const initials = first.length <= 2 || form.firsts.every((f) => f.length <= 2);
    const score = (last * 0.7 + firstFit(first, form.firsts) * 0.3) * (initials ? 0.95 : 1);
    if (better({ score, sameSurname }, best)) best = { score, sameSurname };
  }
  return best;
}

/** A matching surname beats any likeness without one. */
const better = (a: NameFit, b: NameFit) =>
  a.sameSurname !== b.sameSurname ? a.sameSurname : a.score > b.score;

/** The best fit of a printed name across a player's forms. */
export function nameFit(printed: string, forms: readonly NameForm[]): NameFit {
  let best: NameFit = { score: 0, sameSurname: false };
  for (const form of forms) {
    const fit = formFit(printed, form);
    if (better(fit, best)) best = fit;
  }
  return best;
}

/** The best fit as one number: a different surname never scores as the same person. */
export function formsScore(printed: string, forms: readonly NameForm[]): number {
  const fit = nameFit(printed, forms);
  return fit.sameSurname ? fit.score : Math.min(fit.score, DIFFERENT_SURNAME_CAP);
}

/** How well a printed name fits one known name, in [0, 1]. */
export function nameScore(printed: string, known: { first: string; last: string; full: string }): number {
  const legal: NameForm = {
    firsts: [nameTokens(known.first).join("")],
    last: nameTokens(known.last).join(""),
    full: nameTokens(known.full).join(" "),
  };
  return formsScore(printed, [legal, nameForms(known.full, known.last)]);
}

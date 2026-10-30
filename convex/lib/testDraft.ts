/** Test helper: a draft as review leaves it once every name nobody matched is called new. */
export function confirmNew<D extends object>(draft: D): D {
  if (!("lines" in draft) || !Array.isArray(draft.lines)) return draft;
  return { ...draft, lines: draft.lines.map((line: object) => ({ ...line, confirmedNew: true })) };
}

/**
 * Where a band that sticks inside a page's content pins: under the page header, or under the
 * header and `JumpLinks`, with a small gap so it floats. Kept beside those two bars' heights
 * (h-14 / h-16 header; a 49 px jump-link band, 61 px on touch).
 */
export const STICKY_TOP = {
  header: "top-16 @tablet:top-[4.5rem]",
  jumpLinks:
    "top-[7rem] pointer-coarse:top-[7.75rem] @tablet:top-[7.5rem] @tablet:pointer-coarse:top-[8.25rem]",
} as const;

export type StickyBelow = keyof typeof STICKY_TOP;

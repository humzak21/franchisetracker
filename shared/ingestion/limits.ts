/**
 * Largest screenshot stored. Every stored byte is Convex egress again each time a model or a
 * screen reads it, so a full-size PNG is refused: the web app re-encodes before upload
 * (`src/lib/image.ts`) and the Shortcut resizes and converts to JPEG (docs/SHORTCUT.md), both
 * landing well under this.
 */
export const MAX_IMAGE_BYTES = 2 * 1024 * 1024;

export const TOO_LARGE = "Only images up to 2 MB can be imported; send a resized JPEG";

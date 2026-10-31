/** SHA-256 of a file as hex, or null where the browser has no crypto (a page not on https). */
export async function sha256Hex(blob: Blob): Promise<string | null> {
  if (!crypto.subtle) return null;
  const digest = await crypto.subtle.digest("SHA-256", await blob.arrayBuffer());
  return [...new Uint8Array(digest)].map((b) => b.toString(16).padStart(2, "0")).join("");
}

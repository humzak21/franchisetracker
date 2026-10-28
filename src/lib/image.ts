/** Client-side image preparation before upload. */

export type PreparedImage = { blob: Blob; width?: number; height?: number };

/**
 * Long edge after downscaling. The vision models scale anything bigger down to about this
 * before reading it, so extra pixels only cost Convex egress each time a model or a screen
 * fetches the file.
 */
export const MAX_EDGE = 2048;
/** High enough that small box score digits stay crisp; a screenshot PNG shrinks several times over. */
export const JPEG_QUALITY = 0.85;

/** The size to draw at: the long edge capped at `MAX_EDGE`, never upscaled. */
export function fitWithin(width: number, height: number): { width: number; height: number } {
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  return { width: Math.round(width * scale), height: Math.round(height * scale) };
}

/**
 * Re-encodes every image as a downscaled JPEG and reads its dimensions: screenshots arrive as
 * PNGs several megabytes each, and every byte stored is paid for again whenever it is read. A
 * JPEG already within size is kept if it is the smaller file. Anything the browser cannot
 * decode (HEIC in some browsers) is sent as is; the model reads it either way.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file };
  }
  const original = { width: bitmap.width, height: bitmap.height };
  const size = fitWithin(original.width, original.height);
  const canvas = document.createElement("canvas");
  canvas.width = size.width;
  canvas.height = size.height;
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, size.width, size.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) =>
    canvas.toBlob(resolve, "image/jpeg", JPEG_QUALITY),
  );
  const keepOriginal =
    !blob || (file.type === "image/jpeg" && size.width === original.width && file.size <= blob.size);
  return keepOriginal ? { blob: file, ...original } : { blob, ...size };
}

/** Image files from a paste or drop, ignoring text and other file types. */
export function imageFiles(list: FileList | DataTransferItemList | null | undefined): File[] {
  if (!list) return [];
  const files =
    list instanceof FileList
      ? Array.from(list)
      : Array.from(list).flatMap((item) => (item.kind === "file" ? [item.getAsFile()] : []));
  return files.filter((f): f is File => f !== null && f.type.startsWith("image/"));
}

/** Client-side image preparation before upload. */

export type PreparedImage = { blob: Blob; width?: number; height?: number };

/**
 * Long edge after downscaling. Box score digits stay sharp at this size, and a 12 MP phone
 * photo shrinks to a fraction of the upload time and model tokens.
 */
export const MAX_EDGE = 2400;

/**
 * Downscales large photos to JPEG and reads dimensions. Anything the browser cannot decode
 * (HEIC in some browsers) is sent as is; the model reads it either way.
 */
export async function prepareImage(file: Blob): Promise<PreparedImage> {
  let bitmap: ImageBitmap;
  try {
    bitmap = await createImageBitmap(file);
  } catch {
    return { blob: file };
  }
  const { width, height } = bitmap;
  const scale = Math.min(1, MAX_EDGE / Math.max(width, height));
  if (scale === 1 && (file.type === "image/jpeg" || file.type === "image/png")) {
    bitmap.close();
    return { blob: file, width, height };
  }
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(width * scale);
  canvas.height = Math.round(height * scale);
  canvas.getContext("2d")?.drawImage(bitmap, 0, 0, canvas.width, canvas.height);
  bitmap.close();
  const blob = await new Promise<Blob | null>((resolve) => canvas.toBlob(resolve, "image/jpeg", 0.9));
  return blob ? { blob, width: canvas.width, height: canvas.height } : { blob: file, width, height };
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

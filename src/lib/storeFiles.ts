/** Sends files to Convex file storage, one upload URL each, and returns their storage ids in order. */
export async function storeFiles<Id extends string>(
  blobs: readonly Blob[],
  uploadUrl: () => Promise<string>,
): Promise<Id[]> {
  const ids: Id[] = [];
  for (const blob of blobs) {
    const response = await fetch(await uploadUrl(), {
      method: "POST",
      headers: { "Content-Type": blob.type },
      body: blob,
    });
    if (!response.ok) throw new Error(`Upload failed (${response.status})`);
    const { storageId } = (await response.json()) as { storageId: Id };
    ids.push(storageId);
  }
  return ids;
}

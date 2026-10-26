/** Saves text or bytes as a file the browser downloads (exports from Settings → Data). */
export function downloadFile(filename: string, contents: BlobPart, type: string) {
  const url = URL.createObjectURL(new Blob([contents], { type }));
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  document.body.append(link);
  link.click();
  link.remove();
  // Revoke after the click has been handled, or Safari cancels the download.
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

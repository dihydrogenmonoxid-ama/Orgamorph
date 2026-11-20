// Datei-Download ohne Netzwerk: Blob-URL + <a download>.

export function downloadBlob(blob: Blob, name: string): void {
  const url = URL.createObjectURL(blob);
  const a = document.createElement("a");
  a.href = url;
  a.download = name;
  a.rel = "noopener";
  document.body.append(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 2000);
}

export function downloadText(text: string, name: string, type: string): void {
  downloadBlob(new Blob([text], { type }), name);
}

/** Dateiname aus Titel: nur sichere Zeichen. */
export function safeFileName(title: string, fallback = "orgamorph"): string {
  const s = title
    .normalize("NFKD")
    .replace(/[̀-ͯ]/g, "")
    .replace(/ß/g, "ss")
    .replace(/[^A-Za-z0-9._ -]+/g, "")
    .trim()
    .replace(/\s+/g, "-")
    .slice(0, 60);
  return s || fallback;
}

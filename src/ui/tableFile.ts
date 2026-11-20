// Tabellen-Dateien (CSV oder XLSX) im Browser lesen. XLSX wird mit DecompressionStream entpackt.

import { parseCsv } from "../core/io/csv.ts";
import { pickImportSheet, readXlsx } from "../core/io/xlsx.ts";
import { isZip } from "../core/io/zip.ts";

export const TABLE_ACCEPT =
  ".csv,.xlsx,text/csv,text/plain,application/vnd.openxmlformats-officedocument.spreadsheetml.sheet";

export async function inflateRaw(data: Uint8Array): Promise<Uint8Array> {
  const stream = new Blob([data as BlobPart]).stream().pipeThrough(new DecompressionStream("deflate-raw"));
  return new Uint8Array(await new Response(stream).arrayBuffer());
}

export interface TableFile {
  rows: string[][];
  /** bei XLSX: Name des gelesenen Blatts */
  sheet?: string;
}

export class TableFileError extends Error {
  readonly code: "empty" | "unreadable";
  constructor(code: "empty" | "unreadable") {
    super(code);
    this.code = code;
    this.name = "TableFileError";
  }
}

export async function readTableFile(file: File): Promise<TableFile> {
  const bytes = new Uint8Array(await file.arrayBuffer());
  if (isZip(bytes)) {
    let sheets: Awaited<ReturnType<typeof readXlsx>>;
    try {
      sheets = await readXlsx(bytes, inflateRaw);
    } catch {
      throw new TableFileError("unreadable");
    }
    const sheet = pickImportSheet(sheets);
    if (!sheet) throw new TableFileError("empty");
    return { rows: sheet.rows, sheet: sheet.name };
  }
  const rows = parseCsv(new TextDecoder().decode(bytes));
  if (rows.length < 2) throw new TableFileError("empty");
  return { rows };
}

/** Öffnet die Dateiauswahl für CSV/XLSX. */
export function pickTableFile(): Promise<File | null> {
  return new Promise((resolve) => {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = TABLE_ACCEPT;
    input.onchange = () => resolve(input.files?.[0] ?? null);
    input.click();
  });
}

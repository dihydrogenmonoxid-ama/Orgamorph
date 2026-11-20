// XLSX (Office Open XML SpreadsheetML), nur Text-Tabellen:
// Schreiben einer Mappe mit mehreren Blättern, Lesen aller Blätter als Zeilen von Zeichenketten.

import { type InflateRaw, readZip, writeZip } from "./zip.ts";

export interface SheetData {
  name: string;
  rows: string[][];
  /** Spaltenbreiten in Zeichen */
  widths?: number[];
}

const xmlEsc = (s: string) =>
  s
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/./gsu, (c) => {
      const code = c.charCodeAt(0);
      return code < 0x20 && code !== 0x09 && code !== 0x0a && code !== 0x0d ? "" : c;
    });

export function colName(i: number): string {
  let s = "";
  let n = i + 1;
  while (n > 0) {
    const r = (n - 1) % 26;
    s = String.fromCharCode(65 + r) + s;
    n = Math.floor((n - 1) / 26);
  }
  return s;
}

export function colIndex(ref: string): number {
  let n = 0;
  for (const ch of ref.toUpperCase()) {
    const c = ch.charCodeAt(0);
    if (c < 65 || c > 90) break;
    n = n * 26 + (c - 64);
  }
  return n - 1;
}

const NS = "http://schemas.openxmlformats.org/spreadsheetml/2006/main";
const NS_R = "http://schemas.openxmlformats.org/officeDocument/2006/relationships";

function sheetXml(sheet: SheetData): string {
  const width = Math.max(1, ...sheet.rows.map((r) => r.length), sheet.widths?.length ?? 0);
  const cols = Array.from({ length: width }, (_, i) => {
    const w = sheet.widths?.[i] ?? 16;
    // style 2 = Textformat „@“, damit „10.1“ oder „01.100“ nicht als Zahl gelesen werden
    return `<col min="${i + 1}" max="${i + 1}" width="${w}" style="2" customWidth="1"/>`;
  }).join("");
  const rows = sheet.rows
    .map((r, ri) => {
      const cells = r
        .map((v, ci) => {
          if (v === "") return "";
          const style = ri === 0 ? 1 : 2;
          return `<c r="${colName(ci)}${ri + 1}" t="inlineStr" s="${style}"><is><t xml:space="preserve">${xmlEsc(v)}</t></is></c>`;
        })
        .join("");
      return `<row r="${ri + 1}">${cells}</row>`;
    })
    .join("");
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="${NS}" xmlns:r="${NS_R}"><sheetViews><sheetView workbookViewId="0"><pane ySplit="1" topLeftCell="A2" activePane="bottomLeft" state="frozen"/></sheetView></sheetViews><sheetFormatPr defaultRowHeight="15"/><cols>${cols}</cols><sheetData>${rows}</sheetData></worksheet>`;
}

const STYLES = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<styleSheet xmlns="${NS}"><fonts count="2"><font><sz val="11"/><name val="Calibri"/></font><font><b/><sz val="11"/><name val="Calibri"/></font></fonts><fills count="2"><fill><patternFill patternType="none"/></fill><fill><patternFill patternType="gray125"/></fill></fills><borders count="1"><border><left/><right/><top/><bottom/><diagonal/></border></borders><cellStyleXfs count="1"><xf numFmtId="0" fontId="0" fillId="0" borderId="0"/></cellStyleXfs><cellXfs count="3"><xf numFmtId="0" fontId="0" fillId="0" borderId="0" xfId="0"/><xf numFmtId="49" fontId="1" fillId="0" borderId="0" xfId="0" applyFont="1" applyNumberFormat="1"/><xf numFmtId="49" fontId="0" fillId="0" borderId="0" xfId="0" applyNumberFormat="1"/></cellXfs><cellStyles count="1"><cellStyle name="Normal" xfId="0" builtinId="0"/></cellStyles></styleSheet>`;

export function writeXlsx(sheets: readonly SheetData[]): Uint8Array {
  const sheetEntries = sheets.map((s, i) => ({ s, i: i + 1 }));
  const contentTypes = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types"><Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/><Default Extension="xml" ContentType="application/xml"/><Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/><Override PartName="/xl/styles.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.styles+xml"/>${sheetEntries
    .map(
      ({ i }) =>
        `<Override PartName="/xl/worksheets/sheet${i}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`,
    )
    .join("")}</Types>`;
  const rootRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships"><Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/></Relationships>`;
  const workbook = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="${NS}" xmlns:r="${NS_R}"><bookViews><workbookView/></bookViews><sheets>${sheetEntries
    .map(({ s, i }) => `<sheet name="${xmlEsc(s.name.slice(0, 31))}" sheetId="${i}" r:id="rId${i}"/>`)
    .join("")}</sheets></workbook>`;
  const wbRels = `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">${sheetEntries
    .map(
      ({ i }) =>
        `<Relationship Id="rId${i}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i}.xml"/>`,
    )
    .join(
      "",
    )}<Relationship Id="rId${sheets.length + 1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/styles" Target="styles.xml"/></Relationships>`;
  return writeZip([
    { name: "[Content_Types].xml", data: contentTypes },
    { name: "_rels/.rels", data: rootRels },
    { name: "xl/workbook.xml", data: workbook },
    { name: "xl/_rels/workbook.xml.rels", data: wbRels },
    { name: "xl/styles.xml", data: STYLES },
    ...sheetEntries.map(({ s, i }) => ({ name: `xl/worksheets/sheet${i}.xml`, data: sheetXml(s) })),
  ]);
}

// ---------- Lesen ----------

export function xmlUnescape(s: string): string {
  return s.replace(/&(#x[0-9a-fA-F]+|#\d+|amp|lt|gt|quot|apos);/g, (_, e: string) => {
    if (e === "amp") return "&";
    if (e === "lt") return "<";
    if (e === "gt") return ">";
    if (e === "quot") return '"';
    if (e === "apos") return "'";
    const code = e.startsWith("#x") ? Number.parseInt(e.slice(2), 16) : Number.parseInt(e.slice(1), 10);
    return String.fromCodePoint(code);
  });
}

const attr = (tag: string, name: string): string | undefined => {
  const m = tag.match(new RegExp(`\\s${name}="([^"]*)"`));
  return m ? xmlUnescape(m[1]!) : undefined;
};

/** Text aller <t>-Elemente (Rich Text wird zusammengefügt, Phonetik <rPh> ausgelassen). */
function textOf(xml: string): string {
  const clean = xml.replace(/<rPh\b[\s\S]*?<\/rPh>/g, "");
  let out = "";
  for (const m of clean.matchAll(/<t(?:\s[^>]*)?>([\s\S]*?)<\/t>|<t(?:\s[^>]*)?\/>/g))
    out += xmlUnescape(m[1] ?? "");
  return out;
}

export function parseSharedStrings(xml: string): string[] {
  return [...xml.matchAll(/<si>([\s\S]*?)<\/si>|<si\/>/g)].map((m) => textOf(m[1] ?? ""));
}

/** Zahlen ohne Gleitkomma-Artefakte (0.30000000000000004 → 0.3). */
function numText(v: string): string {
  const n = Number(v);
  if (!Number.isFinite(n) || v.trim() === "") return v;
  return String(Number.parseFloat(n.toPrecision(15)));
}

export function parseSheet(xml: string, shared: readonly string[]): string[][] {
  const rows: string[][] = [];
  for (const rm of xml.matchAll(/<row\b([^>]*)>([\s\S]*?)<\/row>|<row\b([^>]*)\/>/g)) {
    const rowAttrs = rm[1] ?? rm[3] ?? "";
    const rIdx = Number(attr(`<row ${rowAttrs}>`, "r") ?? rows.length + 1) - 1;
    const row: string[] = [];
    let next = 0;
    for (const cm of (rm[2] ?? "").matchAll(/<c\b([^>]*?)(?:\/>|>([\s\S]*?)<\/c>)/g)) {
      const head = `<c ${cm[1]}>`;
      const ref = attr(head, "r");
      const ci = ref ? colIndex(ref) : next;
      next = ci + 1;
      const type = attr(head, "t");
      const body = cm[2] ?? "";
      const v = body.match(/<v>([\s\S]*?)<\/v>/)?.[1];
      let value = "";
      if (type === "s") value = shared[Number(v)] ?? "";
      else if (type === "inlineStr") value = textOf(body.match(/<is>([\s\S]*?)<\/is>/)?.[1] ?? "");
      else if (type === "b") value = v === "1" ? "1" : "";
      else if (type === "str" || type === "e") value = xmlUnescape(v ?? "");
      else if (v !== undefined) value = numText(xmlUnescape(v));
      while (row.length < ci) row.push("");
      row[ci] = value;
    }
    while (rows.length < rIdx) rows.push([]);
    rows[rIdx] = row;
  }
  return rows;
}

export interface WorkbookSheet {
  name: string;
  rows: string[][];
}

export async function readXlsx(bytes: Uint8Array, inflateRaw: InflateRaw): Promise<WorkbookSheet[]> {
  const files = await readZip(bytes, inflateRaw);
  const dec = new TextDecoder();
  const text = (name: string) => {
    const f = files.get(name);
    return f ? dec.decode(f) : undefined;
  };
  const workbook = text("xl/workbook.xml");
  if (!workbook) throw new Error("notXlsx");
  const rels = text("xl/_rels/workbook.xml.rels") ?? "";
  const targets = new Map<string, string>();
  for (const m of rels.matchAll(/<Relationship\b[^>]*>/g)) {
    const id = attr(m[0], "Id");
    const target = attr(m[0], "Target");
    if (id && target) targets.set(id, target.startsWith("/") ? target.slice(1) : `xl/${target}`);
  }
  const shared = parseSharedStrings(text("xl/sharedStrings.xml") ?? "");
  const sheets: WorkbookSheet[] = [];
  for (const m of workbook.matchAll(/<sheet\b[^>]*>/g)) {
    const name = attr(m[0], "name") ?? `Sheet${sheets.length + 1}`;
    const rid = attr(m[0], "r:id");
    const path = rid ? targets.get(rid) : undefined;
    const xml = path ? text(path.replace(/\/\.\//g, "/")) : undefined;
    sheets.push({ name, rows: xml ? parseSheet(xml, shared) : [] });
  }
  return sheets;
}

/** Zeilen aus einer Mappe für den Import wählen: zuerst Blätter, die nicht „Beispiel“ heißen und Daten haben. */
export function pickImportSheet(sheets: readonly WorkbookSheet[]): WorkbookSheet | undefined {
  const hasData = (s: WorkbookSheet) => s.rows.slice(1).some((r) => r.some((c) => c.trim() !== ""));
  const isExample = (s: WorkbookSheet) => /^(beispiel|example|sample)/i.test(s.name.trim());
  return sheets.find((s) => !isExample(s) && hasData(s)) ?? sheets.find(hasData);
}

// Textbreiten ohne DOM (ADR 0011). Werte in 1/1000 em, Arial/Helvetica, leicht aufgerundet.

const W: Record<string, number> = {};
const set = (chars: string, w: number) => {
  for (const c of chars) W[c] = w;
};
set(" !,./:;Iijlf|t[]", 278);
set("ijl|", 222);
set('"', 355);
set("'", 191);
set("()-r`{}", 333);
set("*", 389);
set("+<=>~", 584);
set("#$0123456789?_abdeghnopquäöü^", 556);
set("cksvxyzJ", 500);
set("%", 889);
set("&ABEKPSVXYÄ", 667);
set("FTZ", 611);
set("CDHNRUwÜ", 722);
set("GOQÖ", 778);
set("Mm", 833);
set("W", 944);
set("@", 1015);
set("L", 556);
set("ß", 611);
set("–", 556);
set("—…", 1000);
set("·•", 350);

const DEFAULT = 600;
/** Sicherheitsfaktor für abweichende Systemschriften (Segoe UI, SF, Roboto) */
const SAFETY = 1.05;
const BOLD = 1.08;

export function textWidth(text: string, fontSize: number, bold = false): number {
  let units = 0;
  for (const c of text) units += W[c] ?? DEFAULT;
  return Math.ceil((units / 1000) * fontSize * SAFETY * (bold ? BOLD : 1));
}

const ELLIPSIS = "…";

/** Kürzt auf `maxWidth` mit „…“. */
export function truncate(text: string, maxWidth: number, fontSize: number, bold = false): string {
  if (textWidth(text, fontSize, bold) <= maxWidth) return text;
  const chars = [...text];
  let lo = 0;
  let hi = chars.length;
  while (lo < hi) {
    const mid = Math.ceil((lo + hi) / 2);
    if (textWidth(chars.slice(0, mid).join("").trimEnd() + ELLIPSIS, fontSize, bold) <= maxWidth) lo = mid;
    else hi = mid - 1;
  }
  return chars.slice(0, lo).join("").trimEnd() + ELLIPSIS;
}

/** Bricht an Wortgrenzen (und nach Bindestrich/Schrägstrich) auf höchstens `maxLines` Zeilen um. */
export function wrap(
  text: string,
  maxWidth: number,
  fontSize: number,
  maxLines: number,
  bold = false,
): string[] {
  const clean = text.replace(/\s+/g, " ").trim();
  if (!clean) return [];
  const tokens = clean.match(/[^\s\-/]+[-/]?|\s+|[-/]/g) ?? [clean];
  const lines: string[] = [];
  let cur = "";
  for (let i = 0; i < tokens.length; i++) {
    const tok = tokens[i]!;
    const candidate = cur + tok;
    if (textWidth(candidate.trimEnd(), fontSize, bold) <= maxWidth || cur.trim() === "") {
      cur = candidate;
      continue;
    }
    lines.push(cur.trim());
    cur = tok.trimStart();
    if (lines.length === maxLines) {
      // Rest in die letzte Zeile, gekürzt
      const rest = [lines.pop()!, cur, ...tokens.slice(i + 1)].join("").replace(/\s+/g, " ");
      lines.push(truncate(rest.trim(), maxWidth, fontSize, bold));
      return lines;
    }
  }
  if (cur.trim()) lines.push(cur.trim());
  if (lines.length > maxLines) {
    const rest = lines.slice(maxLines - 1).join(" ");
    lines.length = maxLines - 1;
    lines.push(truncate(rest, maxWidth, fontSize, bold));
  }
  return lines.map((l) => truncate(l, maxWidth, fontSize, bold));
}

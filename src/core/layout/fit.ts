// Einpassen auf Seitenformat: A4/A3, Ausrichtung automatisch oder fest,
// Schriftfeld unten, Lesbarkeitsprüfung (kleinste Schrift ≥ 6 pt).

export type PageFormat = "A4" | "A3";
export type OrientationChoice = "auto" | "portrait" | "landscape";

export const PAGE_MM: Record<PageFormat, { w: number; h: number }> = {
  A4: { w: 210, h: 297 },
  A3: { w: 297, h: 420 },
};

export const MM_PER_PT = 25.4 / 72;
export const MM_PER_PX = 25.4 / 96;
export const MIN_LEGIBLE_PT = 6;
/** Höchstens doppelte natürliche Größe, damit kleine Organigramme nicht riesig werden */
export const MAX_SCALE = 2 * MM_PER_PX;

export interface FitInput {
  contentW: number;
  contentH: number;
  /** kleinste Schriftgröße im Inhalt (px) */
  minFontPx: number;
}

export interface FitOptions {
  format: PageFormat;
  orientation: OrientationChoice;
  marginMm: number;
  /** Höhe des Bandes für Schriftfeld und Legende unten */
  footerMm: number;
  /** Abstand zwischen Grafik und Band */
  gapMm?: number;
}

export interface FitResult {
  format: PageFormat;
  orientation: "portrait" | "landscape";
  pageW: number;
  pageH: number;
  /** mm je Inhalts-px */
  scale: number;
  /** Zeichenbereich der Grafik in mm (Seitenkoordinaten) */
  area: { x: number; y: number; w: number; h: number };
  /** Platzierung der Grafik in mm (zentriert im Zeichenbereich) */
  drawing: { x: number; y: number; w: number; h: number };
  minFontPt: number;
  legible: boolean;
}

function fitOne(input: FitInput, opts: FitOptions, orientation: "portrait" | "landscape"): FitResult {
  const base = PAGE_MM[opts.format];
  const pageW = orientation === "landscape" ? base.h : base.w;
  const pageH = orientation === "landscape" ? base.w : base.h;
  const gap = opts.gapMm ?? 4;
  const area = {
    x: opts.marginMm,
    y: opts.marginMm,
    w: pageW - 2 * opts.marginMm,
    h: pageH - 2 * opts.marginMm - opts.footerMm - gap,
  };
  const cw = Math.max(1, input.contentW);
  const ch = Math.max(1, input.contentH);
  const scale = Math.max(0, Math.min(area.w / cw, area.h / ch, MAX_SCALE));
  const w = cw * scale;
  const h = ch * scale;
  const minFontPt = (input.minFontPx * scale) / MM_PER_PT;
  return {
    format: opts.format,
    orientation,
    pageW,
    pageH,
    scale,
    area,
    drawing: { x: area.x + (area.w - w) / 2, y: area.y + (area.h - h) / 2, w, h },
    minFontPt: Math.round(minFontPt * 100) / 100,
    legible: minFontPt >= MIN_LEGIBLE_PT - 1e-9,
  };
}

export function fitToPage(input: FitInput, opts: FitOptions): FitResult {
  if (opts.orientation !== "auto") return fitOne(input, opts, opts.orientation);
  const land = fitOne(input, opts, "landscape");
  const port = fitOne(input, opts, "portrait");
  return port.scale > land.scale + 1e-9 ? port : land;
}

export type LegibilitySuggestion = "useA3" | "stackLeaves" | "focus" | "hideDetails";

/** Vorschläge, wenn die Schrift zu klein wird (§12). */
export function legibilitySuggestions(
  fit: FitResult,
  ctx: { stackLeaves: boolean; hasFocus: boolean; detailsShown: boolean; treeView: boolean },
): LegibilitySuggestion[] {
  if (fit.legible) return [];
  const out: LegibilitySuggestion[] = [];
  if (fit.format === "A4") out.push("useA3");
  if (ctx.treeView && !ctx.stackLeaves) out.push("stackLeaves");
  if (!ctx.hasFocus) out.push("focus");
  if (ctx.detailsShown) out.push("hideDetails");
  return out;
}

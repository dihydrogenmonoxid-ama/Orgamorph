// Grafische Konstanten und Knotenbeschriftung.
// Hier wird die Datenschutzregel durchgesetzt: Name und Stellennummer nur, wenn ausdrücklich eingeschaltet.

import { type LabelOptions, type OrgUnit, TOPIC_PALETTE } from "../model.ts";
import { textWidth, wrap } from "./textMetrics.ts";

export const COLORS = {
  paper: "#F7F6F3",
  surface: "#FFFFFF",
  ink: "#1C1C1C",
  secondary: "#5E5E5E",
  grid: "#E4E2DC",
  signal: "#B3261E",
  line: "#8A8883",
  external: "#9A9893",
  externalFill: "#EFEEEA",
} as const;

export const FONT_STACK = 'system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

export const FONT = {
  short: 12,
  name: 11,
  lead: 10,
  detail: 9,
  star: 10,
  network: 10,
} as const;

export const LINE_HEIGHT = 1.3;
export const STROKE = 1.5;

export const BOX = {
  padX: 8,
  padY: 6,
  minW: 96,
  maxW: 176,
  radius: 3,
  markerSize: 7,
  markerGap: 3,
} as const;

export type TextRole = "short" | "name" | "lead" | "holder" | "position";

export interface LabelLine {
  text: string;
  role: TextRole;
  size: number;
  bold: boolean;
  /** "ink" oder "secondary" */
  tone: "ink" | "secondary";
}

/** Textzeilen eines OE-Kastens. Name und Stellennummer nur bei eingeschalteter Option. */
export function unitLabelLines(
  unit: OrgUnit,
  opts: LabelOptions,
  maxTextWidth = BOX.maxW - 2 * BOX.padX,
): LabelLine[] {
  const lines: LabelLine[] = [];
  const short = unit.shortName?.trim();
  const showShort = opts.shortNames && !!short && short !== unit.name.trim();
  if (showShort) lines.push({ text: short!, role: "short", size: FONT.short, bold: true, tone: "ink" });
  for (const l of wrap(unit.name, maxTextWidth, FONT.name, 2, !showShort))
    lines.push({ text: l, role: "name", size: FONT.name, bold: !showShort, tone: "ink" });

  const lead = unit.lead;
  if (lead) {
    const title = lead.title?.trim();
    const code = opts.leadCode ? lead.code?.trim() : undefined;
    const leadText = title && code ? `${title} (${code})` : (title ?? code);
    if (leadText)
      for (const l of wrap(leadText, maxTextWidth, FONT.lead, 2))
        lines.push({ text: l, role: "lead", size: FONT.lead, bold: false, tone: "secondary" });
    if (opts.holder && lead.holder?.trim())
      for (const l of wrap(lead.holder.trim(), maxTextWidth, FONT.detail, 1))
        lines.push({ text: l, role: "holder", size: FONT.detail, bold: false, tone: "secondary" });
    if (opts.positionNumber && lead.positionNumber?.trim())
      for (const l of wrap(lead.positionNumber.trim(), maxTextWidth, FONT.detail, 1))
        lines.push({ text: l, role: "position", size: FONT.detail, bold: false, tone: "secondary" });
  }
  return lines;
}

export function linesHeight(lines: readonly LabelLine[]): number {
  return lines.reduce((s, l) => s + l.size * LINE_HEIGHT, 0);
}

export function linesWidth(lines: readonly LabelLine[]): number {
  return lines.reduce((m, l) => Math.max(m, textWidth(l.text, l.size, l.bold)), 0);
}

export interface TopicStyle {
  color: string;
  /** Strichmuster ab dem 9. Projekt (§11.2), sonst null */
  dash: string | null;
}

const DASHES = ["6 3", "2 3", "8 3 2 3", "1 2"];

/** Stil eines Projekts nach seiner Position in der Projektliste. */
export function topicStyle(color: string, index: number): TopicStyle {
  const round = Math.floor(index / TOPIC_PALETTE.length);
  return { color, dash: round === 0 ? null : (DASHES[(round - 1) % DASHES.length] ?? null) };
}

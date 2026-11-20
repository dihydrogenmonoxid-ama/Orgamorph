// Druckseite (§12): Grafik eingepasst, Legende unten links, Schriftfeld unten rechts. Einheiten: mm.

import { render } from "preact";
import { RELATION_STYLE, type Scene } from "../core/io/svg.ts";
import type { FitResult } from "../core/layout/fit.ts";
import { COLORS, FONT_STACK } from "../core/layout/style.ts";
import { formatDate, t } from "../i18n/index.ts";
import { SceneContent, SvgDefs } from "./SceneSvg.tsx";

export const FOOTER_MM = 34;
const TITLE_W = 120;
const LOGO_W = 26;

export interface PrintMeta {
  title: string;
  organization?: string;
  department?: string;
  author?: string;
  /** geprüfte data:-URL */
  logo?: string;
  asOf: string;
  date: string | null;
  filterText: string;
  version: string;
}

const clip = (s: string, n: number) => (s.length > n ? `${s.slice(0, n - 1)}…` : s);

export function PrintPage({
  scene,
  fit,
  meta,
  idPrefix = "p-",
}: {
  scene: Scene;
  fit: FitResult;
  meta: PrintMeta;
  idPrefix?: string;
}) {
  const { pageW, pageH } = fit;
  const m = fit.area.x;
  const footY = pageH - m - FOOTER_MM;
  const b = scene.bounds;
  const tbX = pageW - m - TITLE_W;
  const rows: [string, string][] = [
    [t("print.organization"), meta.organization ?? ""],
    [t("print.department"), meta.department ?? ""],
    [t("print.author"), meta.author ?? ""],
    [t("print.asOf"), meta.asOf],
    [t("print.date"), meta.date ? formatDate(meta.date) : t("filter.dateAll")],
    [t("print.filter"), meta.filterText],
  ];
  // Legende in Spalten
  const legend: {
    kind: "topic" | "rel" | "role";
    color?: string;
    dash?: string | null;
    text: string;
    filled?: boolean;
  }[] = [];
  if (scene.mode === "tree" && scene.legendTopics.length) {
    legend.push({ kind: "role", color: COLORS.ink, filled: true, text: t("role.lead") });
    legend.push({ kind: "role", color: COLORS.ink, filled: false, text: t("role.member") });
  }
  for (const tp of scene.legendTopics)
    legend.push({ kind: "topic", color: tp.color, dash: tp.dash, text: tp.title });
  for (const k of scene.legendRelations)
    legend.push({ kind: "rel", dash: RELATION_STYLE[k].dash, text: t(`relationKind.${k}`) });
  const rowH = 4.2;
  const perCol = Math.floor((FOOTER_MM - 2) / rowH);
  const colW = 48;
  const maxCols = Math.max(1, Math.floor((tbX - m - 4) / colW));
  const shown = legend.slice(0, perCol * maxCols);
  const more = legend.length - shown.length;

  return (
    <svg
      xmlns="http://www.w3.org/2000/svg"
      width={`${pageW}mm`}
      height={`${pageH}mm`}
      viewBox={`0 0 ${pageW} ${pageH}`}
      font-family={FONT_STACK}
      role="img"
      aria-label={meta.title}
    >
      <SvgDefs prefix={idPrefix} />
      <rect x={0} y={0} width={pageW} height={pageH} fill="#fff" />
      <svg
        x={fit.drawing.x}
        y={fit.drawing.y}
        width={fit.drawing.w}
        height={fit.drawing.h}
        viewBox={`${b.x} ${b.y} ${b.w} ${b.h}`}
        overflow="visible"
      >
        <SceneContent scene={scene} idPrefix={idPrefix} />
      </svg>

      {/* Legende */}
      <g font-size={2.6} fill={COLORS.ink}>
        {shown.map((e, i) => {
          const col = Math.floor(i / perCol);
          const row = i % perCol;
          const x = m + col * colW;
          const y = footY + 2 + row * rowH;
          return (
            <g key={i} transform={`translate(${x} ${y})`}>
              {e.kind === "topic" && <rect x={0} y={0.4} width={3} height={3} rx={0.4} fill={e.color} />}
              {e.kind === "role" && (
                <rect
                  x={0.2}
                  y={0.6}
                  width={2.6}
                  height={2.6}
                  rx={0.4}
                  fill={e.filled ? e.color : "#fff"}
                  stroke={e.color}
                  stroke-width={0.4}
                />
              )}
              {e.kind === "rel" && (
                <line
                  x1={0}
                  y1={1.9}
                  x2={5}
                  y2={1.9}
                  stroke={COLORS.ink}
                  stroke-width={0.35}
                  stroke-dasharray={
                    e.dash
                      ? e.dash
                          .split(" ")
                          .map((v) => Number(v) * 0.25)
                          .join(" ")
                      : undefined
                  }
                />
              )}
              <text x={e.kind === "rel" ? 6.5 : 4.5} y={2.9}>
                {e.text.length > 30 ? `${e.text.slice(0, 29)}…` : e.text}
              </text>
            </g>
          );
        })}
        {more > 0 && (
          <text x={m} y={pageH - m}>
            {t("print.more", { n: more })}
          </text>
        )}
      </g>

      {/* Plankopf / Schriftfeld */}
      <g transform={`translate(${tbX} ${footY})`} font-size={2.5} fill={COLORS.ink}>
        <rect
          x={0}
          y={0}
          width={TITLE_W}
          height={FOOTER_MM}
          fill="none"
          stroke={COLORS.ink}
          stroke-width={0.35}
        />
        {meta.logo && (
          <>
            <image
              href={meta.logo}
              x={1.5}
              y={1.5}
              width={LOGO_W - 3}
              height={FOOTER_MM - 7.4}
              preserveAspectRatio="xMidYMid meet"
            />
            <line
              x1={LOGO_W}
              y1={0}
              x2={LOGO_W}
              y2={FOOTER_MM - 4.4}
              stroke={COLORS.ink}
              stroke-width={0.25}
            />
          </>
        )}
        <g transform={`translate(${meta.logo ? LOGO_W : 0} 0)`}>
          <text x={2} y={5} font-size={3.8} font-weight={700}>
            {clip(meta.title, meta.logo ? 40 : 52)}
          </text>
          <line
            x1={0}
            y1={7}
            x2={TITLE_W - (meta.logo ? LOGO_W : 0)}
            y2={7}
            stroke={COLORS.ink}
            stroke-width={0.25}
          />
          {rows.map(([k, v], i) => (
            <g key={k}>
              <text x={2} y={10 + i * 3} fill={COLORS.secondary}>
                {k}
              </text>
              <text x={26} y={10 + i * 3}>
                {clip(v, meta.logo ? 48 : 62)}
              </text>
            </g>
          ))}
        </g>
        <line
          x1={0}
          y1={FOOTER_MM - 4.4}
          x2={TITLE_W}
          y2={FOOTER_MM - 4.4}
          stroke={COLORS.ink}
          stroke-width={0.25}
        />
        <text x={2} y={FOOTER_MM - 1.4} fill={COLORS.secondary} font-size={2.2}>
          {t("print.page", { n: 1, total: 1 })}
        </text>
        <text x={TITLE_W - 2} y={FOOTER_MM - 1.4} fill={COLORS.secondary} font-size={2.2} text-anchor="end">
          {t("print.createdWith", { version: meta.version })}
        </text>
      </g>
    </svg>
  );
}

/** Druckt über die Druckansicht des Browsers mit dynamischem @page (ADR 0006). */
export function printPage(node: preact.ComponentChild, fit: FitResult): void {
  let root = document.getElementById("print-root");
  if (!root) {
    root = document.createElement("div");
    root.id = "print-root";
    document.body.append(root);
  }
  render(node, root);
  const style = document.createElement("style");
  style.id = "om-page";
  style.textContent = `@page { size: ${fit.pageW}mm ${fit.pageH}mm; margin: 0 }`;
  document.head.append(style);
  const cleanup = () => {
    style.remove();
    render(null, root!);
    window.removeEventListener("afterprint", cleanup);
  };
  window.addEventListener("afterprint", cleanup);
  window.print();
}

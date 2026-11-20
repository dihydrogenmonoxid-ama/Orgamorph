// Darstellung: Zoom/Pan, Morph zwischen Sichten (600 ms, rAF), Hover-Nachbarschaft, Auswahl.

import { useComputed } from "@preact/signals";
import { useEffect, useLayoutEffect, useMemo, useRef, useState } from "preact/hooks";
import { adjacency, neighbourhood } from "../core/graph.ts";
import type { Scene, SceneNode } from "../core/io/svg.ts";
import type { NodeBox, Rect } from "../core/layout/types.ts";
import { formatNumber, t } from "../i18n/index.ts";
import { Icon } from "../icons/index.tsx";
import { SceneContent, SvgDefs } from "./SceneSvg.tsx";
import {
  displayed,
  doc,
  filtered,
  hovered,
  localDepth,
  scene,
  select,
  selectedUnitId,
  updateView,
} from "./store.ts";

export const MORPH_MS = 600;

const prefersReducedMotion = () =>
  typeof matchMedia === "function" && matchMedia("(prefers-reduced-motion: reduce)").matches;

const ease = (x: number) => (x < 0.5 ? 4 * x * x * x : 1 - (-2 * x + 2) ** 3 / 2);

function lerpBox(a: NodeBox, b: NodeBox, k: number): NodeBox {
  const l = (x: number, y: number) => x + (y - x) * k;
  return {
    id: b.id,
    cx: l(a.cx, b.cx),
    cy: l(a.cy, b.cy),
    w: l(a.w, b.w),
    h: l(a.h, b.h),
    rx: l(a.rx, b.rx),
  };
}

interface Transform {
  k: number;
  x: number;
  y: number;
}

function fitTransform(bounds: Rect, w: number, h: number): Transform {
  if (!w || !h || !bounds.w || !bounds.h) return { k: 1, x: w / 2, y: h / 2 };
  const k = Math.min(w / bounds.w, h / bounds.h, 1.6) * 0.96;
  return { k, x: w / 2 - (bounds.x + bounds.w / 2) * k, y: h / 2 - (bounds.y + bounds.h / 2) * k };
}

/** Kurzbeschreibung der Grafik für Screenreader (§14). */
export function sceneSummary(s: Scene): string {
  const units = s.nodes.filter((n) => n.kind === "unit").length;
  return t("view.summary", {
    view: t(`view.${s.mode}`),
    units,
    topics: s.legendTopics.length,
    relations: s.edges.filter((e) => e.kind === "relation").length,
  });
}

export function SceneView() {
  const svgRef = useRef<SVGSVGElement>(null);
  const [size, setSize] = useState({ w: 800, h: 600 });
  const [tf, setTf] = useState<Transform>({ k: 1, x: 0, y: 0 });
  const [anim, setAnim] = useState<{ boxes: Map<string, NodeBox>; progress: number } | null>(null);
  const prevScene = useRef<Scene | null>(null);
  const shownBoxes = useRef<Map<string, NodeBox>>(new Map());
  const drag = useRef<{ x: number; y: number; tx: number; ty: number; moved: boolean } | null>(null);
  const [dragging, setDragging] = useState(false);

  const s = scene.value;
  const d = doc.value;
  const selected = selectedUnitId.value;
  const hov = hovered.value;

  // Größe beobachten
  useLayoutEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    const ro = new ResizeObserver(() => setSize({ w: el.clientWidth, h: el.clientHeight }));
    ro.observe(el);
    setSize({ w: el.clientWidth, h: el.clientHeight });
    return () => ro.disconnect();
  }, []);

  // Einpassen bei Wechsel von Sicht, Fokus, lokalem Graph oder Dokument
  const fitKey = `${d.id}|${d.view.mode}|${d.view.filter.focusUnitId}|${localDepth.value}|${localDepth.value ? selected : ""}|${size.w}x${size.h}|${d.view.tree.orientation}|${d.view.tree.stackLeaves}`;
  useEffect(() => {
    setTf(fitTransform(s.bounds, size.w, size.h));
  }, [fitKey]);

  // Morph bei Sichtwechsel
  useEffect(() => {
    const prev = prevScene.current;
    prevScene.current = s;
    const target = new Map(s.nodes.map((n) => [n.id, n.box]));
    if (!prev || prev.mode === s.mode || prefersReducedMotion()) {
      shownBoxes.current = target;
      setAnim(null);
      return;
    }
    const from = new Map(shownBoxes.current);
    const start = performance.now();
    let raf = 0;
    const step = (now: number) => {
      const p = Math.min(1, (now - start) / MORPH_MS);
      const k = ease(p);
      const boxes = new Map<string, NodeBox>();
      for (const [id, b] of target) {
        const a = from.get(id);
        boxes.set(id, a ? lerpBox(a, b, k) : b);
      }
      shownBoxes.current = boxes;
      if (p < 1) {
        setAnim({ boxes, progress: p });
        raf = requestAnimationFrame(step);
      } else {
        shownBoxes.current = target;
        setAnim(null);
      }
    };
    raf = requestAnimationFrame(step);
    return () => cancelAnimationFrame(raf);
  }, [s]);

  // Hover-Nachbarschaft (Netz) bzw. Hervorhebung
  const adj = useComputed(() => adjacency(displayed.value));
  const dimmed = useMemo(() => {
    if (!hov || d.view.mode !== "network") return null;
    return neighbourhood(adj.value, hov, 1);
  }, [hov, d.view.mode, adj.value]);

  const zoomBy = (factor: number, cx = size.w / 2, cy = size.h / 2) =>
    setTf((cur) => {
      const k = Math.max(0.05, Math.min(8, cur.k * factor));
      const f = k / cur.k;
      return { k, x: cx - (cx - cur.x) * f, y: cy - (cy - cur.y) * f };
    });

  const onWheel = (e: WheelEvent) => {
    e.preventDefault();
    const rect = svgRef.current!.getBoundingClientRect();
    zoomBy(Math.exp(-e.deltaY * (e.ctrlKey ? 0.01 : 0.0015)), e.clientX - rect.left, e.clientY - rect.top);
  };
  useEffect(() => {
    const el = svgRef.current;
    if (!el) return;
    el.addEventListener("wheel", onWheel, { passive: false });
    return () => el.removeEventListener("wheel", onWheel);
  });

  const onPointerDown = (e: PointerEvent) => {
    if (e.button !== 0) return;
    drag.current = { x: e.clientX, y: e.clientY, tx: tf.x, ty: tf.y, moved: false };
  };
  const onPointerMove = (e: PointerEvent) => {
    const dr = drag.current;
    if (!dr) return;
    const dx = e.clientX - dr.x;
    const dy = e.clientY - dr.y;
    if (!dr.moved && Math.hypot(dx, dy) < 4) return;
    if (!dr.moved) {
      dr.moved = true;
      setDragging(true);
      svgRef.current?.setPointerCapture(e.pointerId);
    }
    setTf((cur) => ({ ...cur, x: dr.tx + dx, y: dr.ty + dy }));
  };
  const onPointerUp = (e: PointerEvent) => {
    const dr = drag.current;
    drag.current = null;
    setDragging(false);
    if (dr?.moved) svgRef.current?.releasePointerCapture(e.pointerId);
  };
  const onBackgroundClick = (e: MouseEvent) => {
    if ((e.target as Element).closest?.(".node")) return;
    if (drag.current?.moved) return;
  };

  const onNodeClick = (n: SceneNode, e: MouseEvent) => {
    e.stopPropagation();
    if (n.unitId) select({ kind: "unit", id: n.unitId });
  };

  const onKeyDown = (e: KeyboardEvent) => {
    const step = 40;
    if (e.key === "+" || e.key === "=") zoomBy(1.2);
    else if (e.key === "-") zoomBy(1 / 1.2);
    else if (e.key === "0") setTf(fitTransform(s.bounds, size.w, size.h));
    else if (e.key === "ArrowLeft") setTf((c) => ({ ...c, x: c.x + step }));
    else if (e.key === "ArrowRight") setTf((c) => ({ ...c, x: c.x - step }));
    else if (e.key === "ArrowUp") setTf((c) => ({ ...c, y: c.y + step }));
    else if (e.key === "ArrowDown") setTf((c) => ({ ...c, y: c.y - step }));
    else return;
    e.preventDefault();
    e.stopPropagation();
  };

  const summary = sceneSummary(s);
  const g = filtered.value;
  const hiddenTopics = new Set(d.view.filter.hiddenTopics);
  const allTopics = d.topics.filter((tp) => g.topics.some((x) => x.id === tp.id) || hiddenTopics.has(tp.id));

  return (
    <div class="canvas">
      <svg
        ref={svgRef}
        class={dragging ? "view dragging" : "view"}
        role="application"
        aria-roledescription={t("view.roledescription")}
        aria-label={summary}
        // biome-ignore lint/a11y/noNoninteractiveTabindex: Zoom/Pan per Tastatur (+, −, 0, Pfeile)
        tabIndex={0}
        onPointerDown={onPointerDown}
        onPointerMove={onPointerMove}
        onPointerUp={onPointerUp}
        onClick={onBackgroundClick}
        onKeyDown={onKeyDown}
        font-family='system-ui, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif'
      >
        <desc>{t("view.desc")}</desc>
        <SvgDefs prefix="v-" />
        <g transform={`translate(${tf.x} ${tf.y}) scale(${tf.k})`}>
          <SceneContent
            scene={s}
            idPrefix="v-"
            boxes={anim?.boxes}
            hideEdges={!!anim}
            textOpacity={anim ? Math.max(0, (anim.progress - 0.6) / 0.4) : 1}
            selectedId={selected}
            dimmed={dimmed}
            onNodeClick={onNodeClick}
            onNodeEnter={(n) => {
              hovered.value = n.id;
            }}
            onNodeLeave={() => {
              hovered.value = null;
            }}
          />
        </g>
      </svg>

      {(allTopics.length > 0 || s.legendRelations.length > 0) && (
        <aside class="legend-overlay" aria-label={t("legend.title")}>
          {allTopics.length > 0 && (
            <ul>
              {allTopics.map((tp) => {
                const visible = !hiddenTopics.has(tp.id);
                return (
                  <li key={tp.id}>
                    <button
                      type="button"
                      aria-pressed={visible}
                      title={visible ? t("legend.hide") : t("legend.show")}
                      onClick={() =>
                        updateView((v) => {
                          v.filter.hiddenTopics = visible
                            ? [...v.filter.hiddenTopics, tp.id]
                            : v.filter.hiddenTopics.filter((x) => x !== tp.id);
                        })
                      }
                    >
                      <span class="swatch" style={{ background: tp.color }} />
                      {tp.shortName || tp.title}
                    </button>
                  </li>
                );
              })}
            </ul>
          )}
          {s.legendRelations.length > 0 && (
            <ul style={{ marginTop: allTopics.length ? "6px" : "0px" }}>
              {s.legendRelations.map((k) => (
                <li key={k}>
                  <svg width="28" height="8" aria-hidden="true">
                    <line
                      x1="1"
                      y1="4"
                      x2="27"
                      y2="4"
                      stroke="#1c1c1c"
                      stroke-width="1.5"
                      stroke-dasharray={
                        { reportsTo: "6 4", directs: undefined, informs: "2 3", coordinates: "8 3 2 3" }[k]
                      }
                    />
                  </svg>
                  {t(`relationKind.${k}`)}
                </li>
              ))}
            </ul>
          )}
        </aside>
      )}

      <div class="canvas-info">
        <span>{t(`view.${s.mode}`)}</span>
        <span>{formatNumber(tf.k * 100)} %</span>
        {d.view.mode === "network" && (
          <label>
            {t("view.local")}{" "}
            <select
              value={localDepth.value}
              onChange={(e) => {
                localDepth.value = Number((e.target as HTMLSelectElement).value) as 0 | 1 | 2;
              }}
            >
              <option value={0}>{t("view.localOff")}</option>
              <option value={1}>{t("view.localDepth", { n: 1 })}</option>
              <option value={2}>{t("view.localDepth", { n: 2 })}</option>
            </select>
          </label>
        )}
      </div>
      <div class="canvas-controls">
        <button type="button" class="btn icon-only" title={t("view.zoomIn")} onClick={() => zoomBy(1.25)}>
          <Icon name="zoomIn" label={t("view.zoomIn")} />
        </button>
        <button type="button" class="btn icon-only" title={t("view.zoomOut")} onClick={() => zoomBy(0.8)}>
          <Icon name="zoomOut" label={t("view.zoomOut")} />
        </button>
        <button
          type="button"
          class="btn icon-only"
          title={t("view.fit")}
          onClick={() => setTf(fitTransform(s.bounds, size.w, size.h))}
        >
          <Icon name="fit" label={t("view.fit")} />
        </button>
      </div>
    </div>
  );
}

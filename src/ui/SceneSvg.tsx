// Preact-Ausgabe einer Szene (ADR 0003). Gleiche Struktur wie sceneToSvgString().

import {
  ARROW_ID,
  ARROW_START_ID,
  EDGE_ORDER,
  type Scene,
  type SceneEdge,
  type SceneNode,
} from "../core/io/svg.ts";
import { COLORS } from "../core/layout/style.ts";
import type { NodeBox } from "../core/layout/types.ts";

export interface SceneSvgProps {
  scene: Scene;
  /** überschreibt Knotenrahmen (Morph) */
  boxes?: ReadonlyMap<string, NodeBox>;
  /** Kanten ausblenden (während des Morphs) */
  hideEdges?: boolean;
  textOpacity?: number;
  selectedId?: string | null;
  dimmed?: ReadonlySet<string> | null;
  onNodeClick?: (n: SceneNode, e: MouseEvent) => void;
  onNodeEnter?: (n: SceneNode) => void;
  onNodeLeave?: (n: SceneNode) => void;
  onNodePointerDown?: (n: SceneNode, e: PointerEvent) => void;
  idPrefix?: string;
}

export function SvgDefs({ prefix = "" }: { prefix?: string }) {
  return (
    <defs>
      <marker
        id={prefix + ARROW_ID}
        viewBox="0 0 10 10"
        refX="9"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto"
      >
        <path d="M0 0L10 5L0 10z" fill={COLORS.ink} />
      </marker>
      <marker
        id={prefix + ARROW_START_ID}
        viewBox="0 0 10 10"
        refX="1"
        refY="5"
        markerWidth="7"
        markerHeight="7"
        orient="auto"
      >
        <path d="M10 0L0 5L10 10z" fill={COLORS.ink} />
      </marker>
    </defs>
  );
}

function Edge({ e, dim, prefix }: { e: SceneEdge; dim: boolean; prefix: string }) {
  return (
    <path
      class={dim ? "edge dim" : "edge"}
      d={e.d}
      fill="none"
      stroke={e.stroke}
      stroke-width={e.width}
      stroke-dasharray={e.dash ?? undefined}
      stroke-opacity={e.opacity < 1 ? e.opacity : undefined}
      stroke-linejoin="round"
      marker-end={e.arrow !== "none" ? `url(#${prefix}${ARROW_ID})` : undefined}
      marker-start={e.arrow === "both" ? `url(#${prefix}${ARROW_START_ID})` : undefined}
    />
  );
}

export function SceneContent(p: SceneSvgProps) {
  const prefix = p.idPrefix ?? "";
  const dim = p.dimmed;
  return (
    <>
      {!p.hideEdges && (
        <g class="edges">
          {EDGE_ORDER.flatMap((kind) =>
            p.scene.edges
              .filter((e) => e.kind === kind)
              .map((e) => (
                <Edge key={e.id} e={e} prefix={prefix} dim={!!dim && !(dim.has(e.from) && dim.has(e.to))} />
              )),
          )}
        </g>
      )}
      <g class="nodes">
        {p.scene.nodes.map((n) => {
          const box = p.boxes?.get(n.id) ?? n.box;
          const cls = [
            "node",
            n.kind,
            p.selectedId === n.id ? "selected" : "",
            dim && !dim.has(n.id) ? "dim" : "",
          ]
            .filter(Boolean)
            .join(" ");
          return (
            <g
              key={n.id}
              class={cls}
              transform={`translate(${box.cx} ${box.cy})`}
              data-node={n.id}
              onClick={p.onNodeClick ? (e) => p.onNodeClick!(n, e as MouseEvent) : undefined}
              onMouseEnter={p.onNodeEnter ? () => p.onNodeEnter!(n) : undefined}
              onMouseLeave={p.onNodeLeave ? () => p.onNodeLeave!(n) : undefined}
              onPointerDown={
                p.onNodePointerDown ? (e) => p.onNodePointerDown!(n, e as PointerEvent) : undefined
              }
            >
              <title>{n.title}</title>
              <rect
                class="frame"
                x={-box.w / 2}
                y={-box.h / 2}
                width={box.w}
                height={box.h}
                rx={box.rx}
                fill={n.fill}
                stroke={n.stroke}
                stroke-width={n.strokeWidth}
                stroke-dasharray={n.dash ?? undefined}
              />
              <g opacity={p.textOpacity ?? 1}>
                {n.markers.map((m) => (
                  <g key={m.topicId}>
                    <rect
                      x={m.x}
                      y={m.y}
                      width={m.size}
                      height={m.size}
                      rx={1}
                      fill={m.filled ? m.color : COLORS.surface}
                      stroke={m.color}
                      stroke-width={1.5}
                    />
                    {m.patterned && (
                      <path
                        d={`M${m.x} ${m.y + m.size}L${m.x + m.size} ${m.y}`}
                        stroke={m.filled ? COLORS.surface : m.color}
                        stroke-width={1}
                      />
                    )}
                  </g>
                ))}
                {n.texts.map((t, i) => (
                  <text
                    key={i}
                    x={t.x}
                    y={t.y}
                    font-size={t.size}
                    font-weight={t.bold ? 700 : undefined}
                    fill={t.fill}
                    text-anchor={t.anchor}
                  >
                    {t.text}
                  </text>
                ))}
              </g>
            </g>
          );
        })}
      </g>
    </>
  );
}

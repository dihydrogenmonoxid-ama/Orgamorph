// Dialoge (native <dialog>, Fokusfalle durch den Browser).

import { signal } from "@preact/signals";
import type { ComponentChildren } from "preact";
import { useEffect, useMemo, useRef, useState } from "preact/hooks";
import { cycleParticipant } from "../core/commands.ts";
import { applyFilter } from "../core/filter.ts";
import { exportTopicsCsv, exportUnitsCsv, parseCsv } from "../core/io/csv.ts";
import { serialize } from "../core/io/json.ts";
import { toOutline } from "../core/io/outline.ts";
import { sceneToSvgString } from "../core/io/svg.ts";
import {
  fitToPage,
  legibilitySuggestions,
  type OrientationChoice,
  type PageFormat,
} from "../core/layout/fit.ts";
import { childIndex, type Id, isValidLogo, type OrgUnit, unitLabel } from "../core/model.ts";
import { downloadBlob, downloadText, safeFileName } from "../export/download.ts";
import { type PngResolution, pngScale, svgToPng } from "../export/png.ts";
import { formatDate, formatNumber, t } from "../i18n/index.ts";
import { Icon } from "../icons/index.tsx";
import { PlanHeaderFields } from "./Forms.tsx";
import {
  conflictKeepMine,
  conflictReload,
  conflictSaveCopy,
  downloadExampleCsv,
  downloadTemplateXlsx,
  importOutlineUnder,
  importTopicsRowsInto,
  importUnitsRowsUnder,
} from "./fileOps.ts";
import { GITHUB_URL, GitHubLink } from "./links.tsx";
import { FOOTER_MM, type PrintMeta, PrintPage, printPage } from "./PrintPage.tsx";
import {
  dialog,
  displayed,
  doc,
  filtered,
  notify,
  readOnly,
  run,
  sceneFor,
  selectedUnitId,
  updateView,
} from "./store.ts";
import { readTableFile, TABLE_ACCEPT, TableFileError } from "./tableFile.ts";

export function Dialog(props: {
  open: boolean;
  title: string;
  onClose: () => void;
  children: ComponentChildren;
  footer?: ComponentChildren;
  size?: "wide" | "narrow";
}) {
  const ref = useRef<HTMLDialogElement>(null);
  useEffect(() => {
    const d = ref.current;
    if (!d) return;
    if (props.open && !d.open) d.showModal();
    if (!props.open && d.open) d.close();
  }, [props.open]);
  return (
    <dialog
      ref={ref}
      class={`dlg ${props.size ?? ""}`}
      aria-label={props.title}
      onClose={() => props.open && props.onClose()}
      onKeyDown={(e) => e.stopPropagation()}
    >
      {props.open && (
        <>
          <div class="dlg-head">
            <h2>{props.title}</h2>
            <button
              type="button"
              class="btn ghost icon-only"
              onClick={props.onClose}
              title={t("action.close")}
            >
              <Icon name="close" label={t("action.close")} />
            </button>
          </div>
          <div class="dlg-body">{props.children}</div>
          {props.footer && <div class="dlg-foot">{props.footer}</div>}
        </>
      )}
    </dialog>
  );
}

const close = () => {
  dialog.value = null;
};

// ---------- Rückfrage ----------

const confirmState = signal<{ text: string; onYes: () => void } | null>(null);

export function confirmDialog(text: string, onYes: () => void): void {
  confirmState.value = { text, onYes };
}

export function ConfirmDialog() {
  const c = confirmState.value;
  const done = () => {
    confirmState.value = null;
  };
  return (
    <Dialog
      open={!!c}
      title={t("confirm.title")}
      size="narrow"
      onClose={done}
      footer={
        <>
          <button type="button" class="btn" onClick={done}>
            {t("action.cancel")}
          </button>
          <button
            type="button"
            class="btn primary"
            // biome-ignore lint/a11y/noAutofocus: Bestätigung per Enter, Abbruch per Esc
            autoFocus
            onClick={() => {
              const yes = c?.onYes;
              done();
              yes?.();
            }}
          >
            {t("action.confirm")}
          </button>
        </>
      }
    >
      <p>{c?.text}</p>
    </Dialog>
  );
}

// ---------- Tastaturhilfe ----------

const KEYS: [string, string][] = [
  ["Enter", "keys.enter"],
  ["Tab / Shift+Tab", "keys.tab"],
  ["Einfg / Insert", "keys.insert"],
  ["F2", "keys.f2"],
  ["Entf / Delete", "keys.delete"],
  ["Alt+↑ / Alt+↓", "keys.altArrows"],
  ["↑ ↓ ← →", "keys.arrows"],
  ["1 / 2 / 3", "keys.views"],
  ["F", "keys.focus"],
  ["Esc", "keys.esc"],
  ["P", "keys.project"],
  ["M", "keys.matrix"],
  ["Strg+Z / Strg+Shift+Z / Strg+Y", "keys.undo"],
  ["Strg+S", "keys.save"],
  ["Strg+O", "keys.open"],
  ["Strg+P", "keys.print"],
  ["+ / − / 0", "keys.zoom"],
  ["?", "keys.help"],
];

export function HelpDialog() {
  return (
    <Dialog open={dialog.value === "help"} title={t("help.title")} onClose={close} size="narrow">
      <table class="help-table">
        <tbody>
          {KEYS.map(([k, d]) => (
            <tr key={d}>
              <td>
                <kbd>{k}</kbd>
              </td>
              <td>{t(d)}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </Dialog>
  );
}

export function AboutDialog() {
  return (
    <Dialog open={dialog.value === "about"} title={t("about.title")} onClose={close} size="narrow">
      <p>
        <strong>Orgamorph</strong> {__VERSION__} · {t("about.build")} {formatDate(__BUILD_DATE__)}
      </p>
      <p>{t("about.tagline")}</p>
      <p>{t("about.privacy")}</p>
      <p>
        {t("about.source")}: <GitHubLink />
        <br />
        <span class="hint">{GITHUB_URL}</span>
      </p>
      <p class="hint">{t("about.license")}</p>
    </Dialog>
  );
}

// ---------- Import ----------

type ImportTab = "units" | "topics" | "outline";

export function ImportDialog() {
  const [tab, setTab] = useState<ImportTab>("units");
  const [text, setText] = useState("");
  const [file, setFile] = useState<File | null>(null);
  const [messages, setMessages] = useState<string[]>([]);
  const d = doc.value;
  const target = selectedUnitId.value ?? d.units.find((u) => u.parentId === null)?.id ?? null;
  const targetUnit = d.units.find((u) => u.id === target);
  const reset = () => {
    setText("");
    setFile(null);
    setMessages([]);
  };
  const switchTab = (x: ImportTab) => {
    setTab(x);
    reset();
  };

  const rowsFromInput = async (): Promise<string[][] | null> => {
    if (file) {
      try {
        return (await readTableFile(file)).rows;
      } catch (e) {
        setMessages([
          t(e instanceof TableFileError ? `import.fileError.${e.code}` : "import.fileError.unreadable"),
        ]);
        return null;
      }
    }
    return parseCsv(text);
  };

  const doImport = async () => {
    if (tab === "outline") {
      if (!target) return;
      const n = importOutlineUnder(target, text);
      if (n) {
        notify(t("import.done", { n }));
        reset();
        close();
      }
      return;
    }
    const rows = await rowsFromInput();
    if (!rows) return;
    const r = tab === "units" && target ? importUnitsRowsUnder(target, rows) : importTopicsRowsInto(rows);
    setMessages(r.issues.length ? r.issues : r.count ? [] : [t("import.tableEmpty")]);
    if (r.count) {
      notify(t(tab === "units" ? "import.done" : "import.topicsDone", { n: r.count }));
      if (!r.issues.length) {
        reset();
        close();
      }
    }
  };

  const tabs: [ImportTab, string][] = [
    ["units", t("import.unitsTable")],
    ["topics", t("import.topicsTable")],
    ["outline", t("import.outline")],
  ];
  const canRun = !readOnly.value && (tab === "outline" ? !!text.trim() : !!file || !!text.trim());

  return (
    <Dialog
      open={dialog.value === "import"}
      title={t("import.title")}
      onClose={close}
      footer={
        <>
          <button type="button" class="btn" onClick={close}>
            {t("action.cancel")}
          </button>
          <button type="button" class="btn primary" disabled={!canRun} onClick={() => void doImport()}>
            {t("import.run")}
          </button>
        </>
      }
    >
      <div class="segmented" role="group" style={{ marginBottom: "12px" }}>
        {tabs.map(([k, label]) => (
          <button key={k} type="button" aria-pressed={tab === k} onClick={() => switchTab(k)}>
            {label}
          </button>
        ))}
      </div>
      {tab === "units" && (
        <p class="hint">{t("import.unitsHint", { target: targetUnit ? unitLabel(targetUnit) : "" })}</p>
      )}
      {tab === "topics" && <p class="hint">{t("import.topicsHint")}</p>}
      {tab === "outline" && (
        <p class="hint">{t("import.outlineHint", { target: targetUnit ? unitLabel(targetUnit) : "" })}</p>
      )}
      {tab !== "outline" && (
        <>
          <div class="field">
            <label for="imp-file">{t("import.fileTable")}</label>
            <input
              id="imp-file"
              type="file"
              accept={TABLE_ACCEPT}
              onChange={(e) => setFile((e.target as HTMLInputElement).files?.[0] ?? null)}
            />
          </div>
          {tab === "units" && (
            <div class="row" style={{ marginBottom: "8px" }}>
              <button type="button" class="btn ghost" onClick={downloadTemplateXlsx}>
                <Icon name="download" />
                {t("empty.templateXlsx")}
              </button>
              <button type="button" class="btn ghost" onClick={downloadExampleCsv}>
                <Icon name="download" />
                {t("empty.exampleCsv")}
              </button>
            </div>
          )}
        </>
      )}
      <div class="field">
        <label for="imp-text">{tab === "outline" ? t("import.text") : t("import.pasteCsv")}</label>
        <textarea
          id="imp-text"
          rows={tab === "outline" ? 12 : 6}
          value={text}
          disabled={!!file && tab !== "outline"}
          onInput={(e) => setText((e.target as HTMLTextAreaElement).value)}
          placeholder={
            tab === "outline"
              ? t("import.outlinePlaceholder")
              : tab === "units"
                ? "ID;Übergeordnet;Bezeichnung;Kürzel"
                : "title;type;from;to;lead;members"
          }
          style={{ fontFamily: "var(--mono)" }}
        />
      </div>
      {messages.length > 0 && (
        <ul class="hints">
          {messages.map((r) => (
            <li key={r}>{r}</li>
          ))}
        </ul>
      )}
    </Dialog>
  );
}

// ---------- Export ----------

function PrivacyChecks({
  v,
  set,
}: {
  v: { holder: boolean; positionNumber: boolean };
  set: (x: typeof v) => void;
}) {
  return (
    <fieldset>
      <legend>{t("export.privacy")}</legend>
      <label class="check">
        <input
          type="checkbox"
          checked={v.holder}
          onChange={(e) => set({ ...v, holder: (e.target as HTMLInputElement).checked })}
        />
        {t("export.showHolder")}
      </label>
      <label class="check">
        <input
          type="checkbox"
          checked={v.positionNumber}
          onChange={(e) => set({ ...v, positionNumber: (e.target as HTMLInputElement).checked })}
        />
        {t("export.showPosition")}
      </label>
      <p class="hint">{t("export.privacyHint")}</p>
    </fieldset>
  );
}

export function ExportDialog() {
  const [privacy, setPrivacy] = useState({ holder: false, positionNumber: false });
  const [res, setRes] = useState<PngResolution>("double");
  const open = dialog.value === "export";
  const d = doc.value;
  const name = safeFileName(d.meta.title);
  const label = { ...d.view.label, ...privacy };
  const exportScene = () => sceneFor(d.view.mode, displayed.value, d, label);
  const svgString = () => {
    const s = exportScene();
    return { s, svg: sceneToSvgString(s, { title: d.meta.title, background: true }) };
  };
  const g = filtered.value;
  const actions: { key: string; icon: "download"; run: () => void | Promise<void> }[] = [
    {
      key: "svg",
      icon: "download",
      run: () => downloadText(svgString().svg, `${name}.svg`, "image/svg+xml"),
    },
    {
      key: "png",
      icon: "download",
      run: async () => {
        const { s, svg } = svgString();
        try {
          const blob = await svgToPng(svg, s.bounds.w, s.bounds.h, pngScale(res, s.bounds.w, s.bounds.h));
          downloadBlob(blob, `${name}.png`);
        } catch {
          notify(t("export.pngFailed"), "signal");
        }
      },
    },
    {
      key: "json",
      icon: "download",
      run: () => downloadText(serialize(d), `${name}.orgamorph.json`, "application/json"),
    },
    {
      key: "csvUnits",
      icon: "download",
      run: () => downloadText(exportUnitsCsv(d, privacy, g.unitIds), `${name}-einheiten.csv`, "text/csv"),
    },
    {
      key: "csvTopics",
      icon: "download",
      run: () =>
        downloadText(
          exportTopicsCsv(d, new Set(g.topics.map((x) => x.id))),
          `${name}-projekte.csv`,
          "text/csv",
        ),
    },
    {
      key: "outline",
      icon: "download",
      run: () => downloadText(toOutline(d, g.rootId), `${name}.txt`, "text/plain"),
    },
  ];
  return (
    <Dialog open={open} title={t("export.title")} onClose={close} size="narrow">
      <p class="hint">{t("export.filterHint")}</p>
      <PrivacyChecks v={privacy} set={setPrivacy} />
      <fieldset>
        <legend>{t("export.png")}</legend>
        <div class="field">
          <label for="png-res">{t("export.resolution")}</label>
          <select
            id="png-res"
            value={res}
            onChange={(e) => setRes((e.target as HTMLSelectElement).value as PngResolution)}
          >
            {(["screen", "double", "printA4", "printA3"] as const).map((r) => (
              <option key={r} value={r}>
                {t(`export.res.${r}`)}
              </option>
            ))}
          </select>
        </div>
      </fieldset>
      <fieldset>
        <legend>{t("export.formats")}</legend>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "8px" }}>
          {actions.map((a) => (
            <button key={a.key} type="button" class="btn" onClick={() => void a.run()}>
              <Icon name={a.icon} />
              {t(`export.as.${a.key}`)}
            </button>
          ))}
        </div>
        <p class="hint" style={{ marginTop: "8px" }}>
          {t("export.jsonHint")}
        </p>
      </fieldset>
    </Dialog>
  );
}

// ---------- Drucken / PDF ----------

export function filterDescription(): string {
  const d = doc.value;
  const f = d.view.filter;
  const parts: string[] = [];
  const focus = f.focusUnitId ? d.units.find((u) => u.id === f.focusUnitId) : undefined;
  parts.push(focus ? `${t("filter.focus")}: ${unitLabel(focus)}` : t("filter.focusAll"));
  if (f.topicTypes !== "all") parts.push(f.topicTypes.map((x) => t(`topicType.${x}`)).join(", "));
  if (f.hiddenTopics.length) parts.push(t("filter.hiddenCount", { n: f.hiddenTopics.length }));
  return parts.join(" · ");
}

export function PrintDialog() {
  const open = dialog.value === "print";
  const [format, setFormat] = useState<PageFormat>("A4");
  const [orientation, setOrientation] = useState<OrientationChoice>("auto");
  const [margin, setMargin] = useState(10);
  const [privacy, setPrivacy] = useState({ holder: false, positionNumber: false });
  const d = doc.value;

  const data = useMemo(() => {
    if (!open) return null;
    const scene = sceneFor(d.view.mode, displayed.value, d, { ...d.view.label, ...privacy });
    const fit = fitToPage(
      { contentW: scene.bounds.w, contentH: scene.bounds.h, minFontPx: scene.minFontPx },
      { format, orientation, marginMm: margin, footerMm: FOOTER_MM },
    );
    const meta: PrintMeta = {
      title: d.meta.title,
      organization: d.meta.organization,
      department: d.meta.department,
      author: d.meta.author,
      logo: isValidLogo(d.meta.logo) ? d.meta.logo : undefined,
      asOf: d.meta.asOf ? formatDate(d.meta.asOf) : formatDate(new Date().toISOString().slice(0, 10)),
      date: d.view.filter.date,
      filterText: filterDescription(),
      version: __VERSION__,
    };
    return { scene, fit, meta };
  }, [open, d, format, orientation, margin, privacy]);

  const suggestions = data
    ? legibilitySuggestions(data.fit, {
        stackLeaves: d.view.tree.stackLeaves,
        hasFocus: !!d.view.filter.focusUnitId,
        detailsShown: privacy.holder || privacy.positionNumber,
        treeView: d.view.mode === "tree",
      })
    : [];

  const doPrint = () => {
    if (!data) return;
    close();
    setTimeout(
      () => printPage(<PrintPage scene={data.scene} fit={data.fit} meta={data.meta} />, data.fit),
      50,
    );
  };

  return (
    <Dialog
      open={open}
      title={t("print.title")}
      onClose={close}
      size="wide"
      footer={
        <>
          <button type="button" class="btn" onClick={close}>
            {t("action.cancel")}
          </button>
          <button type="button" class="btn primary" onClick={doPrint}>
            <Icon name="print" />
            {t("print.run")}
          </button>
        </>
      }
    >
      <div class="print-grid">
        <div>
          <div class="field">
            <span class="label">{t("print.format")}</span>
            <div class="segmented" role="group">
              {(["A4", "A3"] as const).map((f) => (
                <button key={f} type="button" aria-pressed={format === f} onClick={() => setFormat(f)}>
                  {f}
                </button>
              ))}
            </div>
          </div>
          <div class="field">
            <span class="label">{t("print.orientation")}</span>
            <div class="segmented" role="group">
              {(["auto", "portrait", "landscape"] as const).map((o) => (
                <button
                  key={o}
                  type="button"
                  aria-pressed={orientation === o}
                  onClick={() => setOrientation(o)}
                >
                  {t(`print.o.${o}`)}
                </button>
              ))}
            </div>
          </div>
          <div class="field">
            <label for="pr-margin">{t("print.margin")}</label>
            <input
              id="pr-margin"
              type="number"
              min={5}
              max={30}
              value={margin}
              onChange={(e) =>
                setMargin(Math.max(5, Math.min(30, Number((e.target as HTMLInputElement).value) || 10)))
              }
            />
          </div>
          <fieldset>
            <legend>{t("planHead.title")}</legend>
            <PlanHeaderFields compact />
          </fieldset>
          <PrivacyChecks v={privacy} set={setPrivacy} />
          {data && (
            <fieldset>
              <legend>{t("print.legibility")}</legend>
              <p class={data.fit.legible ? "hint" : "hint signal"}>
                {t("print.minFont", { pt: formatNumber(data.fit.minFontPt, 1) })}
              </p>
              {suggestions.length > 0 && (
                <>
                  <p class="hint">{t("print.suggestions")}</p>
                  <div style={{ display: "flex", flexDirection: "column", gap: "4px" }}>
                    {suggestions.map((s) => (
                      <button
                        key={s}
                        type="button"
                        class="btn"
                        onClick={() => {
                          if (s === "useA3") setFormat("A3");
                          else if (s === "stackLeaves")
                            updateView((v) => {
                              v.tree.stackLeaves = true;
                            });
                          else if (s === "hideDetails") setPrivacy({ holder: false, positionNumber: false });
                          else if (s === "focus") {
                            close();
                            notify(t("print.focusHint"));
                          }
                        }}
                      >
                        {t(`print.suggest.${s}`)}
                      </button>
                    ))}
                  </div>
                </>
              )}
            </fieldset>
          )}
          <p class="hint" style={{ marginTop: "12px" }}>
            {t("print.pdfHint")}
          </p>
        </div>
        <figure class="preview" aria-label={t("print.preview")} style={{ margin: 0 }}>
          {data && <PrintPage scene={data.scene} fit={data.fit} meta={data.meta} idPrefix="pv-" />}
        </figure>
      </div>
    </Dialog>
  );
}

// ---------- Konflikt ----------

export function ConflictDialog() {
  return (
    <Dialog
      open={dialog.value === "conflict"}
      title={t("conflict.title")}
      onClose={close}
      size="narrow"
      footer={
        <>
          <button type="button" class="btn" onClick={() => void conflictReload()}>
            {t("conflict.reload")}
          </button>
          <button type="button" class="btn" onClick={() => void conflictSaveCopy()}>
            {t("conflict.copy")}
          </button>
          <button type="button" class="btn primary" onClick={() => void conflictKeepMine()}>
            {t("conflict.keep")}
          </button>
        </>
      }
    >
      <p>{t("conflict.text")}</p>
    </Dialog>
  );
}

// ---------- Beteiligungsmatrix ----------

export function MatrixDialog() {
  const open = dialog.value === "matrix";
  const d = doc.value;
  const idx = childIndex(d.units);
  const rows: { u: OrgUnit; depth: number }[] = [];
  const visit = (p: Id | null, depth: number) => {
    for (const u of idx.get(p) ?? []) {
      rows.push({ u, depth });
      visit(u.id, depth + 1);
    }
  };
  visit(null, 0);
  const g = open ? applyFilter(d) : null;
  const visibleRows = g ? rows.filter((r) => g.unitIds.has(r.u.id)) : rows;

  const onKeyDown = (e: KeyboardEvent) => {
    const btn = (e.target as HTMLElement).closest<HTMLElement>("[data-r]");
    if (!btn) return;
    const r = Number(btn.dataset.r);
    const c = Number(btn.dataset.c);
    const moves: Record<string, [number, number]> = {
      ArrowUp: [-1, 0],
      ArrowDown: [1, 0],
      ArrowLeft: [0, -1],
      ArrowRight: [0, 1],
    };
    const m = moves[e.key];
    if (!m) return;
    e.preventDefault();
    document.querySelector<HTMLElement>(`[data-r="${r + m[0]}"][data-c="${c + m[1]}"]`)?.focus();
  };

  return (
    <Dialog open={open} title={t("matrix.title")} onClose={close} size="wide">
      {d.topics.length === 0 ? (
        <p>{t("topic.empty")}</p>
      ) : (
        <>
          <div class="matrix-legend">
            <span>
              <span class="cell-mark empty" aria-hidden="true" />
              {t("matrix.legendNone")}
            </span>
            <span>
              <span class="cell-mark" style={{ borderColor: "var(--ink)" }} aria-hidden="true" />
              {t("matrix.legendMember")}
            </span>
            <span>
              <span
                class="cell-mark"
                style={{ borderColor: "var(--ink)", background: "var(--ink)" }}
                aria-hidden="true"
              />
              {t("matrix.legendLead")}
            </span>
          </div>
          <p class="hint">{t("matrix.hint")}</p>
          <div class="matrix-wrap">
            <table class="matrix" onKeyDown={onKeyDown}>
              <thead>
                <tr>
                  <th scope="col">
                    <span class="sr-only">{t("matrix.units")}</span>
                  </th>
                  {d.topics.map((tp) => (
                    <th key={tp.id} scope="col" title={tp.title}>
                      <span class="vert">
                        <span class="swatch" style={{ background: tp.color }} />
                        {tp.shortName || tp.title}
                      </span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {visibleRows.map(({ u, depth }, ri) => (
                  <tr key={u.id}>
                    <th scope="row" style={{ paddingLeft: `${8 + depth * 12}px` }}>
                      {unitLabel(u)}
                      {u.shortName && u.shortName !== u.name && <span class="meta"> {u.name}</span>}
                    </th>
                    {d.topics.map((tp, ci) => {
                      const role = tp.participants.find((p) => p.unitId === u.id)?.role;
                      return (
                        <td key={tp.id}>
                          <button
                            type="button"
                            data-r={ri}
                            data-c={ci}
                            disabled={readOnly.value}
                            aria-label={`${unitLabel(u)} – ${tp.title}: ${role ? t(`role.${role}`) : t("role.none")}`}
                            title={`${unitLabel(u)} – ${tp.title}: ${role ? t(`role.${role}`) : t("role.none")}`}
                            onClick={() => run(cycleParticipant(tp, u.id))}
                          >
                            {role && (
                              <span
                                class="cell-mark"
                                style={{
                                  borderColor: tp.color,
                                  background: role === "lead" ? tp.color : "transparent",
                                }}
                              />
                            )}
                          </button>
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </>
      )}
    </Dialog>
  );
}

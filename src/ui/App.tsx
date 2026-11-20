// App-Gerüst (§11.1): Kopf, Werkzeugleiste, Struktur links, Darstellung Mitte, Eigenschaften rechts.

import { useEffect, useRef, useState } from "preact/hooks";
import { RELATION_KINDS, TOPIC_TYPES, unitLabel } from "../core/model.ts";
import { formatNumber, formatTime, type Lang, lang, setLang, t } from "../i18n/index.ts";
import { Icon, type IconName } from "../icons/index.tsx";
import { fileName, saveMode, saveState } from "../persistence/autosave.ts";
import { listDocs, listRecent, type RecentFile, type StoredDoc } from "../persistence/browserStore.ts";
import {
  AboutDialog,
  ConfirmDialog,
  ConflictDialog,
  ExportDialog,
  HelpDialog,
  ImportDialog,
  MatrixDialog,
  PrintDialog,
} from "./Dialogs.tsx";
import { DocumentForm, RelationForm, RelationList, TopicForm, TopicList, UnitForm } from "./Forms.tsx";
import {
  downloadExampleCsv,
  downloadTemplateXlsx,
  type ExampleKey,
  goHome,
  importUnitsRowsAsNew,
  newDocument,
  openExample,
  openFile,
  openRecent,
  openText,
  saveAs,
  saveNow,
} from "./fileOps.ts";
import { GitHubLink } from "./links.tsx";
import { SceneView } from "./SceneView.tsx";
import { StructureActions, StructureEditor } from "./StructureEditor.tsx";
import {
  dialog,
  doc,
  issues,
  leftTab,
  loaded,
  metrics,
  notices,
  notify,
  readOnly,
  redo,
  redoAvailable,
  select,
  selection,
  undo,
  undoAvailable,
  updateView,
} from "./store.ts";
import { pickTableFile, readTableFile, TableFileError } from "./tableFile.ts";

function SaveStatus() {
  const s = saveState.value;
  const mode = saveMode.value;
  let text: string;
  let cls = "status";
  if (s.kind === "saved") text = t("save.savedAt", { time: formatTime(s.at) });
  else if (s.kind === "saving") text = t("save.saving");
  else if (s.kind === "dirty") text = t("save.pending");
  else {
    text = `${t("save.notSaved")}: ${t(`save.reason.${s.reason}`)}`;
    cls += " signal";
  }
  return (
    <span class="row" style={{ alignItems: "center" }}>
      <span class={cls} role="status" aria-live="polite">
        {text}
      </span>
      {mode === "browser" ? (
        <button
          type="button"
          class="status browser btn ghost"
          title={t("save.browserHint")}
          onClick={() => void saveAs()}
        >
          {t("save.browserOnly")}
        </button>
      ) : (
        <span class="status" title={t("save.fileHint")}>
          {fileName.value}
        </span>
      )}
    </span>
  );
}

function ViewSwitch() {
  const mode = doc.value.view.mode;
  const items: [typeof mode, IconName, string][] = [
    ["tree", "tree", "1"],
    ["star", "star", "2"],
    ["network", "network", "3"],
  ];
  return (
    <div class="segmented" role="group" aria-label={t("view.switch")}>
      {items.map(([m, icon, key]) => (
        <button
          key={m}
          type="button"
          aria-pressed={mode === m}
          title={`${t(`view.${m}`)} (${key})`}
          onClick={() =>
            updateView((v) => {
              v.mode = m;
            })
          }
        >
          <Icon name={icon} />
          {t(`view.${m}`)}
        </button>
      ))}
    </div>
  );
}

function FilterMenu() {
  const [open, setOpen] = useState(false);
  const ref = useRef<HTMLSpanElement>(null);
  const v = doc.value.view;
  const f = v.filter;
  const types = f.topicTypes === "all" ? new Set(TOPIC_TYPES) : new Set(f.topicTypes);
  const kinds = f.relationKinds === "all" ? new Set(RELATION_KINDS) : new Set(f.relationKinds);
  const activeCount =
    (f.topicTypes === "all" ? 0 : 1) + (f.relationKinds === "all" ? 0 : 1) + (f.hiddenTopics.length ? 1 : 0);

  // Schließen bei Klick außerhalb
  useEffect(() => {
    if (!open) return;
    const onDown = (e: MouseEvent) => {
      if (!ref.current?.contains(e.target as Node)) setOpen(false);
    };
    document.addEventListener("mousedown", onDown);
    return () => document.removeEventListener("mousedown", onDown);
  }, [open]);

  const Check = (p: { checked: boolean; disabled?: boolean; onChange: () => void; label: string }) => (
    <label class="menu-check">
      <input type="checkbox" checked={p.checked} disabled={p.disabled} onChange={p.onChange} />
      <span>{p.label}</span>
    </label>
  );

  return (
    <span class="menu-anchor" ref={ref}>
      <button
        type="button"
        class="btn"
        aria-expanded={open}
        aria-haspopup="true"
        onClick={() => setOpen(!open)}
      >
        <Icon name="filter" />
        {t("filter.more")}
        {activeCount > 0 && ` (${activeCount})`}
      </button>
      {open && (
        <div
          class="menu"
          role="dialog"
          aria-label={t("filter.more")}
          onKeyDown={(e) => {
            if (e.key === "Escape") {
              e.stopPropagation();
              setOpen(false);
            }
          }}
        >
          <section class="menu-section">
            <h3>{t("filter.topicTypes")}</h3>
            {TOPIC_TYPES.map((x) => (
              <Check
                key={x}
                label={t(`topicType.${x}`)}
                checked={types.has(x)}
                onChange={() =>
                  updateView((vv) => {
                    const next = new Set(types);
                    if (next.has(x)) next.delete(x);
                    else next.add(x);
                    vv.filter.topicTypes = next.size === TOPIC_TYPES.length ? "all" : [...next];
                  })
                }
              />
            ))}
          </section>
          <section class="menu-section">
            <h3>{t("filter.relationKinds")}</h3>
            {RELATION_KINDS.map((x) => (
              <Check
                key={x}
                label={t(`relationKind.${x}`)}
                checked={kinds.has(x)}
                onChange={() =>
                  updateView((vv) => {
                    const next = new Set(kinds);
                    if (next.has(x)) next.delete(x);
                    else next.add(x);
                    vv.filter.relationKinds = next.size === RELATION_KINDS.length ? "all" : [...next];
                  })
                }
              />
            ))}
          </section>
          <section class="menu-section">
            <h3>{t("filter.labels")}</h3>
            {(["shortNames", "leadCode", "holder", "positionNumber"] as const).map((k) => (
              <Check
                key={k}
                label={t(`label.${k}`)}
                checked={v.label[k]}
                onChange={() =>
                  updateView((vv) => {
                    vv.label[k] = !vv.label[k];
                  })
                }
              />
            ))}
          </section>
          <section class="menu-section">
            <h3>{t("filter.treeOptions")}</h3>
            <Check
              label={t("filter.stackLeaves")}
              checked={v.tree.stackLeaves}
              disabled={v.tree.orientation === "left-right"}
              onChange={() =>
                updateView((vv) => {
                  vv.tree.stackLeaves = !vv.tree.stackLeaves;
                })
              }
            />
            <Check
              label={t("filter.leftRight")}
              checked={v.tree.orientation === "left-right"}
              onChange={() =>
                updateView((vv) => {
                  vv.tree.orientation = vv.tree.orientation === "left-right" ? "top-down" : "left-right";
                })
              }
            />
          </section>
          <div class="menu-foot">
            <button
              type="button"
              class="btn"
              onClick={() =>
                updateView((vv) => {
                  vv.filter.topicTypes = "all";
                  vv.filter.relationKinds = "all";
                  vv.filter.hiddenTopics = [];
                })
              }
            >
              {t("filter.reset")}
            </button>
            <button type="button" class="btn primary" onClick={() => setOpen(false)}>
              {t("action.close")}
            </button>
          </div>
        </div>
      )}
    </span>
  );
}

function Toolbar() {
  const d = doc.value;
  const f = d.view.filter;
  return (
    <div class="toolbar" role="toolbar" aria-label={t("toolbar.label")}>
      <ViewSwitch />
      <span class="sep" />
      <label>
        <Icon name="focus" />
        {t("filter.focus")}
        <select
          value={f.focusUnitId ?? ""}
          onChange={(e) =>
            updateView((v) => {
              v.filter.focusUnitId = (e.target as HTMLSelectElement).value || null;
            })
          }
          style={{ maxWidth: "180px" }}
        >
          <option value="">{t("filter.focusAll")}</option>
          {d.units
            .filter((u) => d.units.some((c) => c.parentId === u.id))
            .map((u) => (
              <option key={u.id} value={u.id}>
                {u.shortName && u.shortName !== u.name ? `${u.shortName} – ${u.name}` : u.name}
              </option>
            ))}
        </select>
      </label>
      <label class="check" style={{ margin: 0 }}>
        <input
          type="checkbox"
          checked={f.showExternal}
          disabled={!f.focusUnitId}
          onChange={() =>
            updateView((v) => {
              v.filter.showExternal = !v.filter.showExternal;
            })
          }
        />
        {t("filter.external")}
      </label>
      <label>
        <Icon name="calendar" />
        {t("filter.date")}
        <input
          type="date"
          value={f.date ?? ""}
          onChange={(e) =>
            updateView((v) => {
              v.filter.date = (e.target as HTMLInputElement).value || null;
            })
          }
        />
        {f.date && (
          <button
            type="button"
            class="btn ghost icon-only"
            title={t("filter.dateAll")}
            onClick={() =>
              updateView((v) => {
                v.filter.date = null;
              })
            }
          >
            <Icon name="close" label={t("filter.dateAll")} />
          </button>
        )}
      </label>
      <FilterMenu />
      <span class="spacer" />
      <button
        aria-label={t("matrix.short")}
        type="button"
        class="btn"
        title={`${t("matrix.title")} (M)`}
        onClick={() => (dialog.value = "matrix")}
      >
        <Icon name="matrix" />
        <span class="btn-label">{t("matrix.short")}</span>
      </button>
      <button
        aria-label={t("import.short")}
        type="button"
        class="btn"
        onClick={() => (dialog.value = "import")}
        disabled={readOnly.value}
      >
        <Icon name="upload" />
        <span class="btn-label">{t("import.short")}</span>
      </button>
      <button
        aria-label={t("export.short")}
        type="button"
        class="btn"
        onClick={() => (dialog.value = "export")}
      >
        <Icon name="download" />
        <span class="btn-label">{t("export.short")}</span>
      </button>
      <button
        aria-label={t("print.short")}
        type="button"
        class="btn"
        title={`${t("print.title")} (Strg+P)`}
        onClick={() => (dialog.value = "print")}
      >
        <Icon name="print" />
        <span class="btn-label">{t("print.short")}</span>
      </button>
    </div>
  );
}

function TopBar() {
  const d = doc.value;
  return (
    <header class="topbar">
      <button type="button" class="brand" title={t("action.home")} onClick={() => void goHome()}>
        Orgamorph
      </button>
      <button type="button" class="doc-title" title={t("document.edit")} onClick={() => select(null)}>
        {d.meta.title || t("document.untitled")}
      </button>
      {readOnly.value && <span class="status signal">{t("notice.readOnlyBadge")}</span>}
      <span class="spacer" />
      <button
        type="button"
        class="btn ghost icon-only"
        disabled={!undoAvailable.value}
        title={`${t("action.undo")} (Strg+Z)`}
        onClick={undo}
      >
        <Icon name="undo" label={t("action.undo")} />
      </button>
      <button
        type="button"
        class="btn ghost icon-only"
        disabled={!redoAvailable.value}
        title={`${t("action.redo")} (Strg+Shift+Z)`}
        onClick={redo}
      >
        <Icon name="redo" label={t("action.redo")} />
      </button>
      <SaveStatus />
      <button
        type="button"
        class="btn ghost"
        title={`${t("action.open")} (Strg+O)`}
        onClick={() => void openFile()}
      >
        <Icon name="folder" />
        {t("action.open")}
      </button>
      <button
        type="button"
        class="btn ghost"
        title={`${t("action.save")} (Strg+S)`}
        onClick={() => void saveNow()}
      >
        <Icon name="save" />
        {saveMode.value === "file" ? t("action.save") : t("action.saveFile")}
      </button>
      <button type="button" class="btn ghost" onClick={() => newDocument()}>
        <Icon name="document" />
        {t("action.new")}
      </button>
      <div class="segmented" role="group" aria-label={t("lang.label")}>
        {(["de", "en"] as Lang[]).map((l) => (
          <button key={l} type="button" aria-pressed={lang.value === l} onClick={() => setLang(l)}>
            {l.toUpperCase()}
          </button>
        ))}
      </div>
      <button
        type="button"
        class="btn ghost icon-only"
        title={`${t("help.title")} (?)`}
        onClick={() => (dialog.value = "help")}
      >
        <Icon name="help" label={t("help.title")} />
      </button>
      <button
        type="button"
        class="btn ghost icon-only"
        title={t("about.title")}
        onClick={() => (dialog.value = "about")}
      >
        <Icon name="info" label={t("about.title")} />
      </button>
    </header>
  );
}

function LeftPanel() {
  const tab = leftTab.value;
  const tabs: [typeof tab, string][] = [
    ["structure", t("structure.title")],
    ["topics", t("topic.listTitle")],
    ["relations", t("relation.listTitle")],
  ];
  return (
    <aside class="panel left" aria-label={t("panel.left")}>
      <div class="tabs" role="tablist">
        {tabs.map(([k, label]) => (
          <button
            key={k}
            type="button"
            role="tab"
            aria-selected={tab === k}
            id={`tab-${k}`}
            onClick={() => (leftTab.value = k)}
          >
            {label}
          </button>
        ))}
      </div>
      {tab === "structure" && (
        <>
          <StructureActions />
          <StructureEditor />
        </>
      )}
      {tab === "topics" && <TopicList />}
      {tab === "relations" && <RelationList />}
    </aside>
  );
}

function MetricsPanel() {
  const m = metrics.value;
  const d = doc.value;
  const name = (id: string) => {
    const u = d.units.find((x) => x.id === id);
    return u ? unitLabel(u) : id;
  };
  const hints = issues.value.filter((i) => i.severity === "hint");
  const TopList = ({ items }: { items: { unitId: string; count: number }[] }) => (
    <ol class="toplist">
      {items.map((x) => (
        <li key={x.unitId}>
          <button type="button" onClick={() => select({ kind: "unit", id: x.unitId })}>
            {name(x.unitId)}
          </button>{" "}
          <span class="meta">{x.count}</span>
        </li>
      ))}
    </ol>
  );
  const topicsVals = [...m.unitsPerTopic.values()];
  return (
    <section class="section" aria-label={t("metrics.title")}>
      <h2>{t("metrics.title")}</h2>
      <dl class="kv">
        <dt>{t("metrics.units")}</dt>
        <dd>{m.unitCount}</dd>
        <dt>{t("metrics.depth")}</dt>
        <dd>{m.depth}</dd>
        <dt>{t("metrics.width")}</dt>
        <dd>{m.widthPerLevel.join(" · ")}</dd>
        <dt>{t("metrics.span")}</dt>
        <dd>
          {m.span
            ? `${m.span.min} / ${formatNumber(m.span.median, m.span.median % 1 ? 1 : 0)} / ${m.span.max}`
            : "–"}
        </dd>
        <dt>{t("metrics.topics")}</dt>
        <dd>{m.unitsPerTopic.size}</dd>
        <dt>{t("metrics.unitsPerTopic")}</dt>
        <dd>
          {topicsVals.length
            ? formatNumber(topicsVals.reduce((a, b) => a + b, 0) / topicsVals.length, 1)
            : "–"}
        </dd>
        <dt>{t("metrics.interfaces")}</dt>
        <dd>{m.interfaces.length}</dd>
        <dt title={t("metrics.meshednessHint")}>{t("metrics.meshedness")}</dt>
        <dd>{formatNumber(m.meshedness, 2)}</dd>
      </dl>
      <p class="hint" style={{ marginTop: "4px" }}>
        {t("metrics.spanHint", { n: d.settings.spanOfControlHint })}
      </p>
      {m.topByParticipation.length > 0 && (
        <>
          <h3 style={{ marginTop: "12px" }}>{t("metrics.topParticipation")}</h3>
          <TopList items={m.topByParticipation} />
        </>
      )}
      {m.topByInterfaces.length > 0 && (
        <>
          <h3 style={{ marginTop: "12px" }}>{t("metrics.topInterfaces")}</h3>
          <TopList items={m.topByInterfaces} />
        </>
      )}
      {(hints.length > 0 || (m.span?.aboveHint.length ?? 0) > 0) && (
        <>
          <h3 style={{ marginTop: "12px" }}>{t("metrics.hints")}</h3>
          <ul class="hints">
            {hints.map((h) => (
              <li key={`${h.code}-${h.ids.join()}`}>
                {t(`issue.${h.code}`, { value: h.value ?? "" })}: {h.ids.map(name).join(", ")}
              </li>
            ))}
          </ul>
        </>
      )}
    </section>
  );
}

function RightPanel() {
  const s = selection.value;
  const d = doc.value;
  let content = <DocumentForm />;
  if (s?.kind === "unit") {
    const u = d.units.find((x) => x.id === s.id);
    if (u) content = <UnitForm unit={u} />;
  } else if (s?.kind === "topic") {
    const tp = d.topics.find((x) => x.id === s.id);
    if (tp) content = <TopicForm topic={tp} />;
  } else if (s?.kind === "relation") {
    const r = d.relations.find((x) => x.id === s.id);
    if (r) content = <RelationForm relation={r} />;
  }
  return (
    <aside class="panel right" aria-label={t("panel.right")}>
      {content}
      <MetricsPanel />
    </aside>
  );
}

function Notices() {
  return (
    <div class="notices" aria-live="polite">
      {notices.value.map((n) => (
        <div key={n.id} class={`notice ${n.tone}`}>
          {n.text}
        </div>
      ))}
    </div>
  );
}

function EmptyState() {
  const [recent, setRecent] = useState<RecentFile[]>([]);
  const [stored, setStored] = useState<StoredDoc[]>([]);
  const [importIssues, setImportIssues] = useState<string[]>([]);
  useEffect(() => {
    void listRecent().then(setRecent);
    void listDocs().then(setStored);
  }, []);
  const importTable = async () => {
    const file = await pickTableFile();
    if (!file) return;
    try {
      const { rows } = await readTableFile(file);
      const title = file.name.replace(/\.(csv|xlsx)$/i, "");
      const r = importUnitsRowsAsNew(rows, title);
      if (!r.count) setImportIssues(r.issues.length ? r.issues : [t("import.tableEmpty")]);
      else if (r.issues.length)
        notify(t("import.doneWithIssues", { n: r.count, issues: r.issues.length }), "signal", 8000);
    } catch (e) {
      setImportIssues([
        t(e instanceof TableFileError ? `import.fileError.${e.code}` : "import.fileError.unreadable"),
      ]);
    }
  };
  const examples: ExampleKey[] = ["behoerde", "firma"];
  return (
    <main class="empty">
      <div class="empty-head">
        <h1>Orgamorph</h1>
        <div class="segmented" role="group" aria-label={t("lang.label")}>
          {(["de", "en"] as Lang[]).map((l) => (
            <button key={l} type="button" aria-pressed={lang.value === l} onClick={() => setLang(l)}>
              {l.toUpperCase()}
            </button>
          ))}
        </div>
      </div>
      <p class="lead">{t("empty.lead")}</p>
      <div class="ways">
        <div class="way">
          <h2>{t("empty.exampleTitle")}</h2>
          <p>{t("empty.exampleText")}</p>
          {examples.map((k) => (
            <button key={k} type="button" class="btn" onClick={() => openExample(k)}>
              {t(`example.${k}`)}
            </button>
          ))}
        </div>
        <div class="way">
          <h2>{t("empty.tableTitle")}</h2>
          <p>{t("empty.tableText")}</p>
          <button type="button" class="btn primary" onClick={() => void importTable()}>
            <Icon name="upload" />
            {t("empty.tableRun")}
          </button>
          <div class="way-links">
            <button type="button" class="btn ghost" onClick={downloadTemplateXlsx}>
              <Icon name="download" />
              {t("empty.templateXlsx")}
            </button>
            <button type="button" class="btn ghost" onClick={downloadExampleCsv}>
              <Icon name="download" />
              {t("empty.exampleCsv")}
            </button>
          </div>
          {importIssues.length > 0 && (
            <ul class="hints">
              {importIssues.map((x) => (
                <li key={x} class="hint signal">
                  {x}
                </li>
              ))}
            </ul>
          )}
        </div>
        <div class="way">
          <h2>{t("empty.startTitle")}</h2>
          <p>{t("empty.startText")}</p>
          <button type="button" class="btn" onClick={() => newDocument()}>
            <Icon name="document" />
            {t("empty.new")}
          </button>
          <button type="button" class="btn" onClick={() => void openFile()}>
            <Icon name="folder" />
            {t("empty.open")}
          </button>
        </div>
      </div>
      {(recent.length > 0 || stored.length > 0) && (
        <div class="recent">
          <h2>{t("empty.recent")}</h2>
          <ul class="list">
            {recent.map((r) => (
              <li key={`f-${r.docId}`}>
                <button type="button" class="item" onClick={() => void openRecent(r)}>
                  <Icon name="document" />
                  <span class="grow">{r.name}</span>
                  <span class="meta">{t("empty.fileEntry")}</span>
                </button>
              </li>
            ))}
            {stored
              .filter((x) => !recent.some((r) => r.docId === x.id))
              .slice(0, 8)
              .map((x) => (
                <li key={`b-${x.id}`}>
                  <button type="button" class="item" onClick={() => openText(x.json)}>
                    <Icon name="save" />
                    <span class="grow">{x.title || t("document.untitled")}</span>
                    <span class="meta">
                      {t("empty.browserEntry")} · {x.savedAt.slice(0, 16).replace("T", " ")}
                    </span>
                  </button>
                </li>
              ))}
          </ul>
        </div>
      )}
      <footer class="empty-foot">
        <p class="hint">{t("empty.privacy")}</p>
        <p class="hint">
          Orgamorph {__VERSION__} · EUPL-1.2 · <GitHubLink />
        </p>
      </footer>
    </main>
  );
}

export function App() {
  void lang.value; // Neuzeichnen bei Sprachwechsel
  if (!loaded.value)
    return (
      <div id="orgamorph-root" style={{ height: "100%", overflow: "auto" }}>
        <EmptyState />
        <Notices />
      </div>
    );
  return (
    <div id="orgamorph-root" class="shell">
      <TopBar />
      <Toolbar />
      <div class="main">
        <LeftPanel />
        <SceneView />
        <RightPanel />
      </div>
      <Notices />
      <ConfirmDialog />
      <HelpDialog />
      <AboutDialog />
      <ImportDialog />
      <ExportDialog />
      <PrintDialog />
      <ConflictDialog />
      <MatrixDialog />
    </div>
  );
}

// Eigenschaften-Formulare (§11.1): OE, Projekt/Thema, Beziehung, Dokument. Jede Eingabe = Command.

import { useEffect, useState } from "preact/hooks";
import {
  addRelation,
  addTopic,
  deleteRelation,
  deleteTopic,
  reparentUnit,
  setParticipant,
  updateMeta,
  updateRelation,
  updateSettings,
  updateTopic,
  updateUnit,
} from "../core/commands.ts";
import {
  childIndex,
  type Id,
  isDescendant,
  isValidLogo,
  type OrgUnit,
  RELATION_KINDS,
  type Relation,
  TOPIC_PALETTE,
  TOPIC_TYPES,
  type Topic,
  unitLabel,
} from "../core/model.ts";
import { formatDate, t } from "../i18n/index.ts";
import { Icon } from "../icons/index.tsx";
import { deleteWithConfirm } from "./StructureEditor.tsx";
import { doc, issues, readOnly, run, select, selection, updateView } from "./store.ts";

/** Textfeld mit lokalem Zustand: leere Pflichtfelder werden nicht übernommen, sondern markiert. */
function Text(props: {
  label: string;
  value: string | undefined;
  onChange: (v: string) => void;
  required?: boolean;
  multiline?: boolean;
  list?: string;
  id: string;
  placeholder?: string;
}) {
  const [v, setV] = useState(props.value ?? "");
  useEffect(() => setV(props.value ?? ""), [props.value]);
  const invalid = props.required && !v.trim();
  const onInput = (e: Event) => {
    const next = (e.target as HTMLInputElement).value;
    setV(next);
    if (props.required && !next.trim()) return;
    props.onChange(next);
  };
  return (
    <div class="field">
      <label for={props.id} class={props.required ? "required" : undefined}>
        {props.label}
      </label>
      {props.multiline ? (
        <textarea id={props.id} value={v} onInput={onInput} disabled={readOnly.value} />
      ) : (
        <input
          id={props.id}
          type="text"
          value={v}
          onInput={onInput}
          list={props.list}
          aria-invalid={invalid || undefined}
          aria-required={props.required || undefined}
          disabled={readOnly.value}
          placeholder={props.placeholder}
        />
      )}
      {invalid && <span class="hint signal">{t("form.required")}</span>}
    </div>
  );
}

/** Auswahl einer OE mit Suchfeld (Name oder Kürzel). */
export function UnitPicker(props: {
  id: string;
  label: string;
  value: Id | null;
  onChange: (id: Id) => void;
  exclude?: (u: OrgUnit) => boolean;
}) {
  const d = doc.value;
  const [q, setQ] = useState("");
  const idx = childIndex(d.units);
  const options: { u: OrgUnit; depth: number }[] = [];
  const visit = (p: Id | null, depth: number) => {
    for (const u of idx.get(p) ?? []) {
      options.push({ u, depth });
      visit(u.id, depth + 1);
    }
  };
  visit(null, 0);
  const needle = q.trim().toLowerCase();
  const shown = options.filter(
    ({ u }) =>
      !props.exclude?.(u) &&
      (!needle ||
        u.name.toLowerCase().includes(needle) ||
        (u.shortName ?? "").toLowerCase().includes(needle) ||
        u.id === props.value),
  );
  return (
    <div class="field">
      <label for={props.id}>{props.label}</label>
      <div class="row">
        <input
          type="search"
          placeholder={t("form.search")}
          aria-label={`${props.label}: ${t("form.search")}`}
          value={q}
          onInput={(e) => setQ((e.target as HTMLInputElement).value)}
          style={{ width: "40%" }}
          disabled={readOnly.value}
        />
        <select
          id={props.id}
          value={props.value ?? ""}
          disabled={readOnly.value}
          onChange={(e) => {
            const v = (e.target as HTMLSelectElement).value;
            if (v) props.onChange(v);
          }}
        >
          {props.value === null && <option value="">{t("form.choose")}</option>}
          {shown.map(({ u, depth }) => (
            <option key={u.id} value={u.id}>
              {" ".repeat(depth * 2)}
              {u.shortName && u.shortName !== u.name ? `${u.shortName} – ${u.name}` : u.name}
            </option>
          ))}
        </select>
      </div>
    </div>
  );
}

export function UnitForm({ unit }: { unit: OrgUnit }) {
  const d = doc.value;
  const up = (patch: Parameters<typeof updateUnit>[1]) => run(updateUnit(unit.id, patch));
  const lead = unit.lead ?? {};
  const unitIssues = issues.value.filter((i) => i.ids.includes(unit.id));
  const memberOf = d.topics.filter((tp) => tp.participants.some((p) => p.unitId === unit.id));
  const rels = d.relations.filter((r) => r.from === unit.id || r.to === unit.id);
  const label = (id: Id) => {
    const u = d.units.find((x) => x.id === id);
    return u ? unitLabel(u) : id;
  };
  return (
    <div class="props" key={unit.id}>
      <h2>
        <Icon name="tree" />
        {t("unit.title")}
      </h2>
      <datalist id="level-names">
        {d.settings.levelNames.map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <Text id="u-name" label={t("unit.name")} value={unit.name} required onChange={(v) => up({ name: v })} />
      <div class="row">
        <Text
          id="u-short"
          label={t("unit.shortName")}
          value={unit.shortName}
          onChange={(v) => up({ shortName: v })}
        />
        <Text
          id="u-type"
          label={t("unit.type")}
          value={unit.type}
          list="level-names"
          onChange={(v) => up({ type: v })}
        />
      </div>
      <Text
        id="u-resp"
        label={t("unit.responsibilities")}
        value={unit.responsibilities}
        multiline
        onChange={(v) => up({ responsibilities: v })}
      />
      <label class="check">
        <input
          type="checkbox"
          checked={!!unit.isStaff}
          disabled={readOnly.value || unit.parentId === null}
          onChange={(e) => up({ isStaff: (e.target as HTMLInputElement).checked })}
        />
        {t("unit.isStaff")}
      </label>
      <fieldset>
        <legend>{t("unit.lead")}</legend>
        <div class="row">
          <Text
            id="u-lt"
            label={t("unit.leadTitle")}
            value={lead.title}
            onChange={(v) => up({ lead: { title: v } })}
          />
          <Text
            id="u-lc"
            label={t("unit.leadCode")}
            value={lead.code}
            onChange={(v) => up({ lead: { code: v } })}
          />
        </div>
        <div class="row">
          <Text
            id="u-pn"
            label={t("unit.positionNumber")}
            value={lead.positionNumber}
            onChange={(v) => up({ lead: { positionNumber: v } })}
          />
          <Text
            id="u-h"
            label={t("unit.holder")}
            value={lead.holder}
            onChange={(v) => up({ lead: { holder: v } })}
          />
        </div>
        <p class="hint">{t("unit.privacyHint")}</p>
      </fieldset>
      <fieldset>
        <legend>{t("unit.position")}</legend>
        {unit.parentId === null ? (
          <p class="hint">{t("unit.isRoot")}</p>
        ) : (
          <UnitPicker
            id="u-parent"
            label={t("unit.parent")}
            value={unit.parentId}
            exclude={(u) => u.id === unit.id || isDescendant(d, u.id, unit.id)}
            onChange={(pid) => run(reparentUnit(unit.id, pid))}
          />
        )}
        <Text
          id="u-note"
          label={t("unit.note")}
          value={unit.note}
          multiline
          onChange={(v) => up({ note: v })}
        />
      </fieldset>
      {(memberOf.length > 0 || rels.length > 0) && (
        <fieldset>
          <legend>{t("unit.connections")}</legend>
          <ul class="list">
            {memberOf.map((tp) => (
              <li key={tp.id}>
                <button type="button" class="item" onClick={() => select({ kind: "topic", id: tp.id })}>
                  <span class="swatch" style={{ background: tp.color }} />
                  <span class="grow">{tp.title}</span>
                  <span class="meta">
                    {t(`role.${tp.participants.find((p) => p.unitId === unit.id)!.role}`)}
                  </span>
                </button>
              </li>
            ))}
            {rels.map((r) => (
              <li key={r.id}>
                <button type="button" class="item" onClick={() => select({ kind: "relation", id: r.id })}>
                  <Icon name="relation" />
                  <span class="grow">
                    {label(r.from)} → {label(r.to)}
                  </span>
                  <span class="meta">{t(`relationKind.${r.kind}`)}</span>
                </button>
              </li>
            ))}
          </ul>
        </fieldset>
      )}
      {unitIssues.length > 0 && (
        <fieldset>
          <legend>{t("metrics.hints")}</legend>
          <ul class="hints">
            {unitIssues.map((i) => (
              <li key={i.code}>{t(`issue.${i.code}`, { value: i.value ?? "" })}</li>
            ))}
          </ul>
        </fieldset>
      )}
      <div class="row" style={{ marginTop: "16px" }}>
        <button
          type="button"
          class="btn"
          onClick={() =>
            updateView((v) => {
              v.filter.focusUnitId = v.filter.focusUnitId === unit.id ? null : unit.id;
            })
          }
        >
          <Icon name="focus" />
          {d.view.filter.focusUnitId === unit.id ? t("filter.focusOff") : t("filter.focusOn")}
        </button>
        {unit.parentId !== null && (
          <button
            type="button"
            class="btn danger"
            disabled={readOnly.value}
            onClick={() => deleteWithConfirm(unit.id)}
          >
            <Icon name="trash" />
            {t("structure.delete")}
          </button>
        )}
      </div>
    </div>
  );
}

function ParticipantsEditor({ topic }: { topic: Topic }) {
  const d = doc.value;
  const [q, setQ] = useState("");
  const needle = q.trim().toLowerCase();
  const role = (id: Id) => topic.participants.find((p) => p.unitId === id)?.role ?? null;
  const units = d.units
    .filter(
      (u) =>
        !needle ||
        u.name.toLowerCase().includes(needle) ||
        (u.shortName ?? "").toLowerCase().includes(needle),
    )
    .sort((a, b) => Number(role(b.id) !== null) - Number(role(a.id) !== null));
  return (
    <div class="field">
      <span class="label">{t("topic.participants", { n: topic.participants.length })}</span>
      <input
        type="search"
        placeholder={t("form.search")}
        aria-label={t("form.searchUnits")}
        value={q}
        onInput={(e) => setQ((e.target as HTMLInputElement).value)}
      />
      <ul class="list participants" aria-label={t("topic.participantsList")}>
        {units.map((u) => {
          const r = role(u.id);
          const opt = (value: "lead" | "member" | null, text: string) => (
            <button
              type="button"
              title={value ? t(`role.${value}`) : t("role.none")}
              aria-label={`${unitLabel(u)}: ${value ? t(`role.${value}`) : t("role.none")}`}
              aria-pressed={r === value}
              disabled={readOnly.value}
              onClick={() => run(setParticipant(topic.id, u.id, value))}
            >
              {text}
            </button>
          );
          return (
            <li key={u.id}>
              <span class="grow" title={u.name}>
                {unitLabel(u)}
                {u.shortName && u.shortName !== u.name && <span class="meta"> {u.name}</span>}
              </span>
              <span class="segmented" role="group" aria-label={unitLabel(u)}>
                {opt(null, "–")}
                {opt("member", t("role.memberShort"))}
                {opt("lead", t("role.leadShort"))}
              </span>
            </li>
          );
        })}
      </ul>
      <span class="hint">{t("topic.roleHint")}</span>
    </div>
  );
}

export function TopicForm({ topic }: { topic: Topic }) {
  const up = (patch: Parameters<typeof updateTopic>[1]) => run(updateTopic(topic.id, patch));
  const permanent = !topic.period.to;
  const invalidPeriod = !!(topic.period.from && topic.period.to && topic.period.from > topic.period.to);
  return (
    <div class="props" key={topic.id}>
      <h2>
        <Icon name="topic" />
        {t("topic.title")}
      </h2>
      <Text
        id="t-title"
        label={t("topic.name")}
        value={topic.title}
        required
        onChange={(v) => up({ title: v })}
      />
      <div class="row">
        <Text
          id="t-short"
          label={t("topic.shortName")}
          value={topic.shortName}
          onChange={(v) => up({ shortName: v })}
        />
        <div class="field">
          <label for="t-type">{t("topic.type")}</label>
          <select
            id="t-type"
            value={topic.type}
            disabled={readOnly.value}
            onChange={(e) => up({ type: (e.target as HTMLSelectElement).value as Topic["type"] })}
          >
            {TOPIC_TYPES.map((x) => (
              <option key={x} value={x}>
                {t(`topicType.${x}`)}
              </option>
            ))}
          </select>
        </div>
      </div>
      <div class="row">
        <div class="field">
          <label for="t-from">{t("topic.from")}</label>
          <input
            id="t-from"
            type="date"
            value={topic.period.from ?? ""}
            disabled={readOnly.value}
            onChange={(e) => up({ period: { ...topic.period, from: (e.target as HTMLInputElement).value } })}
          />
        </div>
        <div class="field">
          <label for="t-to">{t("topic.to")}</label>
          <input
            id="t-to"
            type="date"
            value={topic.period.to ?? ""}
            disabled={readOnly.value || permanent}
            aria-invalid={invalidPeriod || undefined}
            onChange={(e) => up({ period: { ...topic.period, to: (e.target as HTMLInputElement).value } })}
          />
        </div>
      </div>
      <label class="check">
        <input
          type="checkbox"
          checked={permanent}
          disabled={readOnly.value}
          onChange={(e) => {
            const on = (e.target as HTMLInputElement).checked;
            const today = new Date().toISOString().slice(0, 10);
            up({ period: { ...topic.period, to: on ? "" : (topic.period.from ?? today) } });
          }}
        />
        {t("topic.permanent")}
      </label>
      <div class="field">
        <span class="label">{t("topic.color")}</span>
        <div class="palette" role="group" aria-label={t("topic.color")}>
          {TOPIC_PALETTE.map((c) => (
            <button
              key={c}
              type="button"
              style={{ background: c }}
              aria-pressed={topic.color === c}
              aria-label={c}
              disabled={readOnly.value}
              onClick={() => up({ color: c })}
            />
          ))}
        </div>
      </div>
      <ParticipantsEditor topic={topic} />
      <Text
        id="t-note"
        label={t("topic.note")}
        value={topic.note}
        multiline
        onChange={(v) => up({ note: v })}
      />
      <button
        type="button"
        class="btn danger"
        disabled={readOnly.value}
        onClick={() => {
          if (run(deleteTopic(topic.id))) select(null);
        }}
      >
        <Icon name="trash" />
        {t("topic.delete")}
      </button>
    </div>
  );
}

export function RelationForm({ relation }: { relation: Relation }) {
  const up = (patch: Partial<Omit<Relation, "id">>) => run(updateRelation(relation.id, patch));
  return (
    <div class="props" key={relation.id}>
      <h2>
        <Icon name="relation" />
        {t("relation.title")}
      </h2>
      <UnitPicker
        id="r-from"
        label={t("relation.from")}
        value={relation.from}
        onChange={(id) => up({ from: id })}
      />
      <div class="field">
        <label for="r-kind">{t("relation.kind")}</label>
        <select
          id="r-kind"
          value={relation.kind}
          disabled={readOnly.value}
          onChange={(e) => up({ kind: (e.target as HTMLSelectElement).value as Relation["kind"] })}
        >
          {RELATION_KINDS.map((k) => (
            <option key={k} value={k}>
              {t(`relationKind.${k}`)}
            </option>
          ))}
        </select>
      </div>
      <UnitPicker id="r-to" label={t("relation.to")} value={relation.to} onChange={(id) => up({ to: id })} />
      <Text
        id="r-note"
        label={t("relation.note")}
        value={relation.note}
        multiline
        onChange={(v) => up({ note: v })}
      />
      <button
        type="button"
        class="btn danger"
        disabled={readOnly.value}
        onClick={() => {
          if (run(deleteRelation(relation.id))) select(null);
        }}
      >
        <Icon name="trash" />
        {t("relation.delete")}
      </button>
    </div>
  );
}

/** Logo-Datei → data:-URL. Rastergrafiken werden auf höchstens 600 × 300 px verkleinert. */
async function logoFromFile(file: File): Promise<string> {
  if (file.type === "image/svg+xml") {
    const text = await file.text();
    if (/<script|\son\w+=|javascript:/i.test(text)) throw new Error("logoUnsafe");
    let bin = "";
    for (const byte of new TextEncoder().encode(text)) bin += String.fromCharCode(byte);
    const b64 = btoa(bin);
    return `data:image/svg+xml;base64,${b64}`;
  }
  if (!/^image\/(png|jpeg|webp|gif|bmp)$/.test(file.type)) throw new Error("logoType");
  const url = URL.createObjectURL(file);
  try {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error("logoType"));
      img.src = url;
    });
    const scale = Math.min(1, 600 / img.naturalWidth, 300 / img.naturalHeight);
    const canvas = document.createElement("canvas");
    canvas.width = Math.max(1, Math.round(img.naturalWidth * scale));
    canvas.height = Math.max(1, Math.round(img.naturalHeight * scale));
    canvas.getContext("2d")!.drawImage(img, 0, 0, canvas.width, canvas.height);
    return canvas.toDataURL("image/png");
  } finally {
    URL.revokeObjectURL(url);
  }
}

/** Plankopf: Titel, Organisation, Organisationseinheit, Ersteller, Stand, Logo. Im Dokumentformular und im Druckdialog. */
export function PlanHeaderFields({ compact = false }: { compact?: boolean }) {
  const d = doc.value;
  const [logoError, setLogoError] = useState<string | null>(null);
  const prefix = compact ? "ph" : "d";
  const onLogo = async (e: Event) => {
    const input = e.target as HTMLInputElement;
    const file = input.files?.[0];
    input.value = "";
    if (!file) return;
    try {
      const url = await logoFromFile(file);
      if (!isValidLogo(url)) throw new Error("logoSize");
      setLogoError(null);
      run(updateMeta({ logo: url }));
    } catch (err) {
      const code = (err as Error).message;
      setLogoError(
        t(`planHead.${["logoUnsafe", "logoType", "logoSize"].includes(code) ? code : "logoType"}`),
      );
    }
  };
  return (
    <>
      <Text
        id={`${prefix}-title`}
        label={t("document.name")}
        value={d.meta.title}
        onChange={(v) => run(updateMeta({ title: v }))}
      />
      <Text
        id={`${prefix}-org`}
        label={t("document.organization")}
        value={d.meta.organization}
        onChange={(v) => run(updateMeta({ organization: v }))}
      />
      <div class="row">
        <Text
          id={`${prefix}-dept`}
          label={t("planHead.department")}
          value={d.meta.department}
          onChange={(v) => run(updateMeta({ department: v }))}
        />
        <Text
          id={`${prefix}-author`}
          label={t("planHead.author")}
          value={d.meta.author}
          onChange={(v) => run(updateMeta({ author: v }))}
        />
      </div>
      {!compact && (
        <div class="field">
          <label for="d-asof">{t("document.asOf")}</label>
          <input
            id="d-asof"
            type="date"
            value={d.meta.asOf ?? ""}
            disabled={readOnly.value}
            onChange={(e) => run(updateMeta({ asOf: (e.target as HTMLInputElement).value }))}
          />
        </div>
      )}
      <div class="field">
        <span class="label">{t("planHead.logo")}</span>
        <div class="logo-row">
          {d.meta.logo && isValidLogo(d.meta.logo) ? (
            <img class="logo-preview" src={d.meta.logo} alt={t("planHead.logoAlt")} />
          ) : (
            <span class="hint">{t("planHead.noLogo")}</span>
          )}
          <label class="btn">
            <Icon name="upload" />
            {d.meta.logo ? t("planHead.logoReplace") : t("planHead.logoAdd")}
            <input
              type="file"
              class="sr-only"
              accept="image/png,image/jpeg,image/webp,image/svg+xml"
              disabled={readOnly.value}
              onChange={(e) => void onLogo(e)}
            />
          </label>
          {d.meta.logo && (
            <button
              type="button"
              class="btn ghost icon-only"
              title={t("planHead.logoRemove")}
              disabled={readOnly.value}
              onClick={() => run(updateMeta({ logo: "" }))}
            >
              <Icon name="trash" label={t("planHead.logoRemove")} />
            </button>
          )}
        </div>
        {logoError && <span class="hint signal">{logoError}</span>}
        <span class="hint">{t("planHead.hint")}</span>
      </div>
    </>
  );
}

export function DocumentForm() {
  const d = doc.value;
  return (
    <div class="props">
      <h2>
        <Icon name="document" />
        {t("document.title")}
      </h2>
      <fieldset style={{ marginTop: 0, borderTop: 0, paddingTop: 0 }}>
        <legend>{t("planHead.title")}</legend>
        <PlanHeaderFields />
      </fieldset>
      <fieldset>
        <legend>{t("document.settings")}</legend>
        <Text
          id="d-levels"
          label={t("document.levelNames")}
          value={d.settings.levelNames.join(", ")}
          onChange={(v) =>
            run(
              updateSettings({
                levelNames: v
                  .split(",")
                  .map((x) => x.trim())
                  .filter(Boolean),
              }),
            )
          }
        />
        <div class="field">
          <label for="d-span">{t("document.spanHint")}</label>
          <input
            id="d-span"
            type="number"
            min={1}
            max={99}
            value={d.settings.spanOfControlHint}
            disabled={readOnly.value}
            onChange={(e) => {
              const n = Number((e.target as HTMLInputElement).value);
              if (n >= 1) run(updateSettings({ spanOfControlHint: n }));
            }}
          />
        </div>
      </fieldset>
      <p class="hint">
        {t("document.created")}: {formatDate(d.meta.created.slice(0, 10))} · {t("document.modified")}:{" "}
        {formatDate(d.meta.modified.slice(0, 10))}
      </p>
    </div>
  );
}

export function TopicList() {
  const d = doc.value;
  const sel = selection.value;
  const add = () => {
    const id = run(addTopic({ title: t("topic.newName") }));
    if (typeof id === "string") {
      select({ kind: "topic", id });
      requestAnimationFrame(() => (document.getElementById("t-title") as HTMLInputElement | null)?.select());
    }
  };
  return (
    <>
      <div class="panel-actions">
        <button type="button" class="btn" disabled={readOnly.value} onClick={add} title="P">
          <Icon name="plus" />
          {t("topic.add")}
        </button>
      </div>
      <div class="panel-body">
        {d.topics.length === 0 && <p class="empty-list">{t("topic.empty")}</p>}
        <ul class="list">
          {d.topics.map((tp) => (
            <li key={tp.id}>
              <button
                type="button"
                class="item"
                aria-current={sel?.kind === "topic" && sel.id === tp.id}
                onClick={() => select({ kind: "topic", id: tp.id })}
              >
                <span class="swatch" style={{ background: tp.color }} />
                <span class="grow">
                  {tp.title}
                  <br />
                  <span class="meta">
                    {t(`topicType.${tp.type}`)} · {periodText(tp)} ·{" "}
                    {t("topic.count", { n: tp.participants.length })}
                  </span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

export function periodText(tp: Topic): string {
  const { from, to } = tp.period;
  if (!from && !to) return t("topic.periodOpen");
  if (from && !to) return t("topic.periodSince", { from: formatDate(from) });
  if (!from && to) return t("topic.periodUntil", { to: formatDate(to) });
  return `${formatDate(from!)} – ${formatDate(to!)}`;
}

export function RelationList() {
  const d = doc.value;
  const sel = selection.value;
  const label = (id: Id) => {
    const u = d.units.find((x) => x.id === id);
    return u ? unitLabel(u) : id;
  };
  const add = () => {
    const root = d.units.find((u) => u.parentId === null);
    const from = selection.value?.kind === "unit" ? selection.value.id : (d.units[1]?.id ?? root?.id);
    const to = d.units.find((u) => u.id !== from)?.id;
    if (!from || !to) return;
    const id = run(addRelation({ from, to, kind: "reportsTo" }));
    if (typeof id === "string") select({ kind: "relation", id });
  };
  return (
    <>
      <div class="panel-actions">
        <button type="button" class="btn" disabled={readOnly.value || d.units.length < 2} onClick={add}>
          <Icon name="plus" />
          {t("relation.add")}
        </button>
      </div>
      <div class="panel-body">
        {d.relations.length === 0 && <p class="empty-list">{t("relation.empty")}</p>}
        <ul class="list">
          {d.relations.map((r) => (
            <li key={r.id}>
              <button
                type="button"
                class="item"
                aria-current={sel?.kind === "relation" && sel.id === r.id}
                onClick={() => select({ kind: "relation", id: r.id })}
              >
                <Icon name="relation" />
                <span class="grow">
                  {label(r.from)} → {label(r.to)}
                  <br />
                  <span class="meta">{t(`relationKind.${r.kind}`)}</span>
                </span>
              </button>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
}

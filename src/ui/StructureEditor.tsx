// Struktur-Editor (§11.1, §13): ARIA-Baum, vollständig per Tastatur.
// Enter = Geschwister darunter, Tab/Shift+Tab = ein-/ausrücken, F2 = umbenennen, Entf = löschen,
// Alt+↑/↓ = Reihenfolge, ←/→ = zu-/aufklappen, ↑/↓ = navigieren.

import { useLayoutEffect, useRef } from "preact/hooks";
import {
  addChild,
  addSibling,
  deleteUnit,
  indentUnit,
  moveUnit,
  outdentUnit,
  updateUnit,
} from "../core/commands.ts";
import { childIndex, type Id, type OrgUnit, subtreeIds } from "../core/model.ts";
import { t } from "../i18n/index.ts";
import { Icon } from "../icons/index.tsx";
import { confirmDialog } from "./Dialogs.tsx";
import {
  collapsed,
  doc,
  neighbourAfterDelete,
  readOnly,
  renaming,
  run,
  select,
  selectedUnitId,
  updateView,
} from "./store.ts";

const focusItem = (id: Id | null) => {
  if (!id) return;
  requestAnimationFrame(() => document.getElementById(`tree-${id}`)?.focus());
};

/** Sichtbare Reihenfolge (aufgeklappte Knoten) für ↑/↓. */
function visibleOrder(units: readonly OrgUnit[], closed: ReadonlySet<Id>): Id[] {
  const idx = childIndex(units);
  const out: Id[] = [];
  const visit = (parent: Id | null) => {
    for (const u of idx.get(parent) ?? []) {
      out.push(u.id);
      if (!closed.has(u.id)) visit(u.id);
    }
  };
  visit(null);
  return out;
}

export function deleteWithConfirm(id: Id): void {
  const d = doc.value;
  const unit = d.units.find((u) => u.id === id);
  if (!unit) return;
  if (unit.parentId === null) {
    run(deleteUnit(id));
    return;
  }
  const n = subtreeIds(d, id).length;
  const next = neighbourAfterDelete(id);
  const go = () => {
    if (run(deleteUnit(id))) {
      select(next ? { kind: "unit", id: next } : null);
      focusItem(next);
    }
  };
  if (n > 1) confirmDialog(t("structure.confirmDelete", { name: unit.name, n }), go);
  else go();
}

function RenameInput({ unit }: { unit: OrgUnit }) {
  const ref = useRef<HTMLInputElement>(null);
  const original = useRef(unit.name);
  // Layout-Effekt: Fokus sofort nach dem Einhängen, damit schnelles Tippen nicht verloren geht
  useLayoutEffect(() => {
    ref.current?.focus();
    ref.current?.select();
  }, []);
  const commit = () => {
    const v = ref.current?.value.trim() ?? "";
    if (v && v !== unit.name) run(updateUnit(unit.id, { name: v }));
  };
  const finish = () => {
    commit();
    renaming.value = null;
    focusItem(unit.id);
  };
  const onKeyDown = (e: KeyboardEvent) => {
    e.stopPropagation();
    if (e.key === "Enter") {
      e.preventDefault();
      commit();
      if (unit.parentId === null) {
        const id = run(addChild(unit.id, { name: t("unit.newName") }));
        if (typeof id === "string") {
          select({ kind: "unit", id });
          renaming.value = id;
        }
        return;
      }
      const id = run(addSibling(unit.id, { name: t("unit.newName") }));
      if (typeof id === "string") {
        select({ kind: "unit", id });
        renaming.value = id;
      }
    } else if (e.key === "Tab") {
      e.preventDefault();
      commit();
      run(e.shiftKey ? outdentUnit(unit.id) : indentUnit(unit.id));
      requestAnimationFrame(() => ref.current?.focus());
    } else if (e.key === "Escape") {
      e.preventDefault();
      if (ref.current) ref.current.value = original.current;
      renaming.value = null;
      focusItem(unit.id);
    }
  };
  return (
    <input
      ref={ref}
      type="text"
      defaultValue={unit.name}
      aria-label={t("unit.name")}
      onKeyDown={onKeyDown}
      onBlur={() => {
        // Verzögert prüfen: Beim Ein-/Ausrücken oder Anlegen wird das Feld neu eingehängt und verliert
        // kurz den Fokus. Nur ein echtes Verlassen (Feld noch eingehängt, Fokus woanders) beendet das Bearbeiten.
        setTimeout(() => {
          const el = ref.current;
          if (!el?.isConnected || document.activeElement === el) return;
          if (renaming.value === unit.id) finish();
        }, 0);
      }}
    />
  );
}

function TreeNode({
  unit,
  idx,
  level,
  topicColors,
}: {
  unit: OrgUnit;
  idx: Map<Id | null, OrgUnit[]>;
  level: number;
  topicColors: Map<Id, string[]>;
}) {
  const kids = idx.get(unit.id) ?? [];
  const isOpen = !collapsed.value.has(unit.id);
  const selected = selectedUnitId.value === unit.id;
  const editing = renaming.value === unit.id;
  const focus = doc.value.view.filter.focusUnitId === unit.id;

  const toggle = () => {
    const next = new Set(collapsed.value);
    if (isOpen) next.add(unit.id);
    else next.delete(unit.id);
    collapsed.value = next;
  };

  return (
    <li
      id={`tree-${unit.id}`}
      class="tree-item"
      role="treeitem"
      aria-level={level}
      aria-selected={selected}
      aria-expanded={kids.length ? isOpen : undefined}
      tabIndex={selected || (!selectedUnitId.value && level === 1) ? 0 : -1}
      data-id={unit.id}
    >
      <div
        class="tree-row"
        style={{ paddingLeft: `${(level - 1) * 16 + 4}px` }}
        onClick={() => select({ kind: "unit", id: unit.id })}
        onDblClick={() => {
          if (!readOnly.value) renaming.value = unit.id;
        }}
      >
        {kids.length ? (
          <button
            type="button"
            class="tree-toggle"
            tabIndex={-1}
            aria-hidden="true"
            onClick={(e) => {
              e.stopPropagation();
              toggle();
            }}
          >
            <Icon name={isOpen ? "chevronDown" : "chevronRight"} />
          </button>
        ) : (
          <span class="tree-toggle" />
        )}
        {editing ? (
          <RenameInput unit={unit} />
        ) : (
          <>
            {unit.shortName && unit.shortName !== unit.name && (
              <span class="tree-short">{unit.shortName}</span>
            )}
            <span class="tree-name">{unit.name}</span>
            {unit.isStaff && (
              <span class="tree-staff" title={t("unit.isStaff")}>
                {t("unit.staffBadge")}
              </span>
            )}
            {focus && <span class="tree-staff">{t("filter.focusBadge")}</span>}
            {(topicColors.get(unit.id) ?? []).slice(0, 6).map((c, i) => (
              <span key={i} class="tree-dot" style={{ background: c }} aria-hidden="true" />
            ))}
          </>
        )}
      </div>
      {kids.length > 0 && isOpen && (
        <ul role="group">
          {kids.map((k) => (
            <TreeNode key={k.id} unit={k} idx={idx} level={level + 1} topicColors={topicColors} />
          ))}
        </ul>
      )}
    </li>
  );
}

export function StructureEditor() {
  const d = doc.value;
  const idx = childIndex(d.units);
  const roots = idx.get(null) ?? [];
  const topicColors = new Map<Id, string[]>();
  for (const tp of d.topics)
    for (const p of tp.participants)
      topicColors.set(p.unitId, [...(topicColors.get(p.unitId) ?? []), tp.color]);

  const onKeyDown = (e: KeyboardEvent) => {
    const target = (e.target as HTMLElement).closest<HTMLElement>(".tree-item");
    if (!target || (e.target as HTMLElement).tagName === "INPUT") return;
    const id = target.dataset.id!;
    const unit = d.units.find((u) => u.id === id);
    if (!unit) return;
    const order = visibleOrder(d.units, collapsed.value);
    const pos = order.indexOf(id);
    const ro = readOnly.value;
    const key = e.key;
    const handled = () => {
      e.preventDefault();
      e.stopPropagation();
    };

    if (key === "ArrowDown" && e.altKey) {
      handled();
      if (!ro) run(moveUnit(id, 1));
      focusItem(id);
    } else if (key === "ArrowUp" && e.altKey) {
      handled();
      if (!ro) run(moveUnit(id, -1));
      focusItem(id);
    } else if (key === "ArrowDown" || key === "ArrowUp") {
      handled();
      const next = order[pos + (key === "ArrowDown" ? 1 : -1)];
      if (next) {
        select({ kind: "unit", id: next });
        focusItem(next);
      }
    } else if (key === "Home" || key === "End") {
      handled();
      const next = key === "Home" ? order[0] : order[order.length - 1];
      if (next) {
        select({ kind: "unit", id: next });
        focusItem(next);
      }
    } else if (key === "ArrowRight") {
      handled();
      if (collapsed.value.has(id)) {
        const n = new Set(collapsed.value);
        n.delete(id);
        collapsed.value = n;
      } else {
        const first = idx.get(id)?.[0];
        if (first) {
          select({ kind: "unit", id: first.id });
          focusItem(first.id);
        }
      }
    } else if (key === "ArrowLeft") {
      handled();
      if ((idx.get(id)?.length ?? 0) > 0 && !collapsed.value.has(id)) {
        collapsed.value = new Set([...collapsed.value, id]);
      } else if (unit.parentId) {
        select({ kind: "unit", id: unit.parentId });
        focusItem(unit.parentId);
      }
    } else if (ro) {
      return;
    } else if (key === "Enter") {
      handled();
      const newId = unit.parentId
        ? run(addSibling(id, { name: t("unit.newName") }))
        : run(addChild(id, { name: t("unit.newName") }));
      if (typeof newId === "string") {
        select({ kind: "unit", id: newId });
        renaming.value = newId;
      }
    } else if (key === "Insert") {
      handled();
      const newId = run(addChild(id, { name: t("unit.newName") }));
      if (typeof newId === "string") {
        select({ kind: "unit", id: newId });
        renaming.value = newId;
      }
    } else if (key === "Tab") {
      handled();
      run(e.shiftKey ? outdentUnit(id) : indentUnit(id));
      focusItem(id);
    } else if (key === "F2") {
      handled();
      renaming.value = id;
    } else if (key === "Delete" || key === "Backspace") {
      handled();
      deleteWithConfirm(id);
    }
  };

  return (
    <div class="panel-body">
      <ul class="tree" role="tree" aria-label={t("structure.title")} onKeyDown={onKeyDown}>
        {roots.map((r) => (
          <TreeNode key={r.id} unit={r} idx={idx} level={1} topicColors={topicColors} />
        ))}
      </ul>
      <p class="hint" style={{ padding: "0 16px 16px" }}>
        {t("structure.keysHint")}
      </p>
    </div>
  );
}

export function StructureActions() {
  const sel = selectedUnitId.value;
  const d = doc.value;
  const unit = sel ? d.units.find((u) => u.id === sel) : undefined;
  const ro = readOnly.value;
  const target = unit ?? d.units.find((u) => u.parentId === null);
  const addChildHere = () => {
    if (!target) return;
    const id = run(addChild(target.id, { name: t("unit.newName") }));
    if (typeof id === "string") {
      select({ kind: "unit", id });
      renaming.value = id;
    }
  };
  return (
    <div class="panel-actions">
      <button
        type="button"
        class="btn"
        disabled={ro}
        onClick={addChildHere}
        title={t("structure.addChildKey")}
      >
        <Icon name="child" />
        {t("structure.addChild")}
      </button>
      <button
        type="button"
        class="btn icon-only"
        disabled={ro || !unit?.parentId}
        title={t("structure.addSibling")}
        onClick={() => {
          if (!unit) return;
          const id = run(addSibling(unit.id, { name: t("unit.newName") }));
          if (typeof id === "string") {
            select({ kind: "unit", id });
            renaming.value = id;
          }
        }}
      >
        <Icon name="plus" label={t("structure.addSibling")} />
      </button>
      <button
        type="button"
        class="btn icon-only"
        disabled={ro || !unit?.parentId}
        title={t("structure.outdent")}
        onClick={() => unit && run(outdentUnit(unit.id))}
      >
        <Icon name="outdent" label={t("structure.outdent")} />
      </button>
      <button
        type="button"
        class="btn icon-only"
        disabled={ro || !unit?.parentId}
        title={t("structure.indent")}
        onClick={() => unit && run(indentUnit(unit.id))}
      >
        <Icon name="indent" label={t("structure.indent")} />
      </button>
      <button
        type="button"
        class="btn icon-only"
        disabled={ro || !unit?.parentId}
        title={t("structure.moveUp")}
        onClick={() => unit && run(moveUnit(unit.id, -1))}
      >
        <Icon name="up" label={t("structure.moveUp")} />
      </button>
      <button
        type="button"
        class="btn icon-only"
        disabled={ro || !unit?.parentId}
        title={t("structure.moveDown")}
        onClick={() => unit && run(moveUnit(unit.id, 1))}
      >
        <Icon name="down" label={t("structure.moveDown")} />
      </button>
      <button
        type="button"
        class="btn icon-only"
        disabled={!unit}
        title={t("filter.focusOn")}
        onClick={() =>
          unit &&
          updateView((v) => {
            v.filter.focusUnitId = v.filter.focusUnitId === unit.id ? null : unit.id;
          })
        }
      >
        <Icon name="focus" label={t("filter.focusOn")} />
      </button>
      <button
        type="button"
        class="btn icon-only danger"
        disabled={ro || !unit?.parentId}
        title={t("structure.delete")}
        onClick={() => unit && deleteWithConfirm(unit.id)}
      >
        <Icon name="trash" label={t("structure.delete")} />
      </button>
    </div>
  );
}

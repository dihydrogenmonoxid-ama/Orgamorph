// Einstieg: Rendern, Autosave verdrahten, globale Tastenkürzel (§13).

import { effect } from "@preact/signals";
import { render } from "preact";
import { addTopic } from "./core/commands.ts";
import { lang, setLang, t } from "./i18n/index.ts";
import { autosaver } from "./persistence/autosave.ts";
import { App } from "./ui/App.tsx";
import { openFile, saveNow } from "./ui/fileOps.ts";
import {
  dialog,
  doc,
  leftTab,
  loaded,
  readOnly,
  redo,
  run,
  select,
  selectedUnitId,
  undo,
  updateView,
} from "./ui/store.ts";

setLang(lang.value);

// Autosave: jede neue Dokument-Wurzel planen (Debounce im Autosaver)
effect(() => {
  const d = doc.value;
  if (loaded.value && !readOnly.value) autosaver.schedule(d);
});
autosaver.onConflict = () => {
  dialog.value = "conflict";
};
autosaver.installLifecycle();

const isTyping = (el: EventTarget | null) => {
  const e = el as HTMLElement | null;
  if (!e) return false;
  const tag = e.tagName;
  return tag === "INPUT" || tag === "TEXTAREA" || tag === "SELECT" || e.isContentEditable;
};

document.addEventListener("keydown", (e) => {
  if (!loaded.value) return;
  const mod = e.ctrlKey || e.metaKey;
  const key = e.key.toLowerCase();
  if (dialog.value && !mod) return; // Dialoge behandeln ihre Tasten selbst
  if (mod && key === "s") {
    e.preventDefault();
    void saveNow();
    return;
  }
  if (mod && key === "o") {
    e.preventDefault();
    void openFile();
    return;
  }
  if (mod && key === "p") {
    e.preventDefault();
    dialog.value = "print";
    return;
  }
  if (isTyping(e.target)) return;
  if (mod && (key === "y" || (key === "z" && e.shiftKey))) {
    e.preventDefault();
    redo();
    return;
  }
  if (mod && key === "z") {
    e.preventDefault();
    undo();
    return;
  }
  if (mod || e.altKey) return;
  const setMode = (m: "tree" | "star" | "network") =>
    updateView((v) => {
      v.mode = m;
    });
  switch (e.key) {
    case "1":
      setMode("tree");
      break;
    case "2":
      setMode("star");
      break;
    case "3":
      setMode("network");
      break;
    case "f":
    case "F": {
      const id = selectedUnitId.value;
      if (!id) return;
      updateView((v) => {
        v.filter.focusUnitId = id;
      });
      break;
    }
    case "Escape":
      updateView((v) => {
        v.filter.focusUnitId = null;
      });
      break;
    case "p":
    case "P": {
      const id = run(addTopic({ title: t("topic.newName") }));
      if (typeof id === "string") {
        leftTab.value = "topics";
        select({ kind: "topic", id });
        requestAnimationFrame(() =>
          (document.getElementById("t-title") as HTMLInputElement | null)?.select(),
        );
      }
      break;
    }
    case "m":
    case "M":
      dialog.value = "matrix";
      break;
    case "?":
      dialog.value = "help";
      break;
    default:
      return;
  }
  e.preventDefault();
});

const host = document.getElementById("app");
if (host) render(<App />, host);

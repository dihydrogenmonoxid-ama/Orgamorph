// i18n ohne Bibliothek (E10). de.json ist die Quelle, en.json muss dieselben Schlüssel haben.

import { signal } from "@preact/signals";
import de from "./de.json";
import en from "./en.json";

export type Lang = "de" | "en";
type Tree = { [k: string]: string | Tree };

export function flatten(tree: Tree, prefix = "", out: Record<string, string> = {}): Record<string, string> {
  for (const [k, v] of Object.entries(tree)) {
    const key = prefix ? `${prefix}.${k}` : k;
    if (typeof v === "string") out[key] = v;
    else flatten(v, key, out);
  }
  return out;
}

const DICT: Record<Lang, Record<string, string>> = { de: flatten(de as Tree), en: flatten(en as Tree) };
const STORAGE_KEY = "orgamorph:lang";

function initialLang(): Lang {
  try {
    const stored = globalThis.localStorage?.getItem(STORAGE_KEY);
    if (stored === "de" || stored === "en") return stored;
  } catch {
    /* Speicher nicht verfügbar */
  }
  const nav = globalThis.navigator?.language ?? "de";
  return nav.toLowerCase().startsWith("de") ? "de" : nav.toLowerCase().startsWith("en") ? "en" : "de";
}

export const lang = signal<Lang>(initialLang());

export function setLang(l: Lang): void {
  lang.value = l;
  try {
    globalThis.localStorage?.setItem(STORAGE_KEY, l);
  } catch {
    /* ignorieren */
  }
  if (globalThis.document) document.documentElement.lang = l;
}

/** Übersetzt `key`; `{name}` wird durch `params.name` ersetzt. Fehlender Schlüssel → Schlüssel selbst. */
export function t(key: string, params?: Record<string, string | number>): string {
  const s = DICT[lang.value][key] ?? DICT.de[key] ?? key;
  if (!params) return s;
  return s.replace(/\{(\w+)\}/g, (m, p: string) => (p in params ? String(params[p]) : m));
}

export function hasKey(key: string): boolean {
  return key in DICT.de;
}

export function formatNumber(n: number, digits = 0): string {
  return new Intl.NumberFormat(lang.value === "de" ? "de-DE" : "en-GB", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  }).format(n);
}

export function formatDate(iso: string): string {
  const [y, m, d] = iso.split("-");
  return lang.value === "de" ? `${d}.${m}.${y}` : `${y}-${m}-${d}`;
}

export function formatTime(date: Date): string {
  return date.toLocaleTimeString(lang.value === "de" ? "de-DE" : "en-GB", { hour12: false });
}

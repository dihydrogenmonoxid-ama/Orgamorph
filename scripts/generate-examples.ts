// Erzeugt die Beispiele in examples/ (deterministische IDs): npm run examples
import { createHash } from "node:crypto";
import { writeFileSync } from "node:fs";
import { serialize } from "../src/core/io/json.ts";
import { exampleCsv, templateXlsx } from "../src/core/io/templates.ts";
import {
  defaultSettings,
  defaultView,
  type OrgDocument,
  type OrgUnit,
  type RelationKind,
  TOPIC_PALETTE,
  type Topic,
  type TopicType,
} from "../src/core/model.ts";
import { assertValid } from "../src/core/validate.ts";

const OUT = new URL("../examples/", import.meta.url).pathname;

const hid = (p: string, key: string) => {
  const h = createHash("sha256").update(key).digest();
  const A = "abcdefghijklmnopqrstuvwxyz0123456789";
  let s = "";
  for (let i = 0; i < 10; i++) s += A[h[i]! % 36];
  return `${p}_${s}`;
};

type U = [key: string, parent: string | null, name: string, extra?: Partial<OrgUnit>];
type T = [
  title: string,
  type: TopicType,
  from: string | null,
  to: string | null,
  lead: string[],
  members: string[],
  extra?: Partial<Topic>,
];
type R = [from: string, to: string, kind: RelationKind, note?: string];

function build(
  slug: string,
  meta: { title: string; organization: string },
  levelNames: string[],
  us: U[],
  ts: T[],
  rs: R[],
  view: Partial<OrgDocument["view"]> = {},
): OrgDocument {
  const id = (k: string) => hid("u", `${slug}:${k}`);
  const units: OrgUnit[] = us.map(([k, p, name, extra]) => ({
    id: id(k),
    parentId: p ? id(p) : null,
    name,
    ...(extra ?? {}),
  }));
  const topics: Topic[] = ts.map(([t, type, from, to, lead, members, extra], i) => ({
    id: hid("t", `${slug}:${t}`),
    title: t,
    ...(extra?.shortName ? { shortName: extra.shortName } : {}),
    type,
    period: { ...(from ? { from } : {}), ...(to ? { to } : {}) },
    participants: [
      ...lead.map((k) => ({ unitId: id(k), role: "lead" as const })),
      ...members.map((k) => ({ unitId: id(k), role: "member" as const })),
    ],
    color: TOPIC_PALETTE[i % 8]!,
    ...(extra?.note ? { note: extra.note } : {}),
  }));
  const relations = rs.map(([f, t, kind, note], i) => ({
    id: hid("r", `${slug}:${i}`),
    from: id(f),
    to: id(t),
    kind,
    ...(note ? { note } : {}),
  }));
  const doc: OrgDocument = {
    format: "orgamorph",
    schemaVersion: 1,
    id: hid("d", slug),
    meta: {
      ...meta,
      asOf: "2026-11-01",
      created: "2026-11-20T09:00:00.000Z",
      modified: "2026-11-20T09:00:00.000Z",
    },
    units,
    topics,
    relations,
    settings: { ...defaultSettings(), levelNames },
    view: { ...defaultView(), ...view },
  };
  assertValid(doc);
  writeFileSync(`${OUT}${slug}.orgamorph.json`, serialize(doc));
  console.log(slug, units.length, "OEs", topics.length, "Themen", relations.length, "Beziehungen");
  return doc;
}

// ---------- Stadtverwaltung nach KGSt-Verwaltungsgliederungsplan ----------
// Aufgabenhauptgruppen 1–6 als Dezernate, Ämter mit KGSt-Kennziffern. Namen und Stellen frei erfunden.
const amt = (k: string, p: string, nr: string, name: string): U => [
  k,
  p,
  name,
  {
    shortName: nr,
    type: "Amt",
    lead: { title: "Amtsleitung", code: `AL ${nr}`, positionNumber: `${nr}.000` },
  },
];
const sg = (k: string, p: string, nr: string, name: string): U => [
  k,
  p,
  name,
  {
    shortName: nr,
    type: "Sachgebiet",
    lead: { title: "Sachgebietsleitung", code: `SGL ${nr}`, positionNumber: `${nr}0` },
  },
];
const dez = (k: string, nr: string, name: string, resp: string): U => [
  k,
  "ob",
  `Dezernat ${nr} – ${name}`,
  {
    shortName: `Dez ${nr}`,
    type: "Dezernat",
    responsibilities: resp,
    lead: { title: "Beigeordnete/r", code: `B ${nr}` },
  },
];

build(
  "beispiel-behoerde-kgst",
  { title: "Stadtverwaltung Musterstadt", organization: "Stadt Musterstadt" },
  ["Verwaltungsleitung", "Dezernat", "Amt", "Sachgebiet"],
  [
    [
      "ob",
      null,
      "Oberbürgermeister",
      {
        shortName: "OB",
        type: "Verwaltungsleitung",
        lead: { title: "Oberbürgermeister", code: "OB", positionNumber: "00.001", holder: "Max Mustermann" },
      },
    ],
    ["buero", "ob", "Büro Oberbürgermeister", { shortName: "BOB", isStaff: true, type: "Stabsstelle" }],
    [
      "a13",
      "ob",
      "Presse- und Öffentlichkeitsarbeit",
      { shortName: "13", isStaff: true, type: "Stabsstelle", lead: { title: "Pressesprecher", code: "PS" } },
    ],
    [
      "a14",
      "ob",
      "Rechnungsprüfungsamt",
      {
        shortName: "14",
        isStaff: true,
        type: "Stabsstelle",
        lead: { title: "Amtsleitung", code: "AL 14", positionNumber: "14.000" },
      },
    ],
    ["gst", "ob", "Gleichstellungsstelle", { shortName: "GSt", isStaff: true, type: "Stabsstelle" }],
    dez("d1", "I", "Allgemeine Verwaltung", "Aufgabenhauptgruppe 1"),
    amt("a10", "d1", "10", "Hauptamt"),
    sg("a10-1", "a10", "10.1", "Organisation"),
    sg("a10-2", "a10", "10.2", "Informationstechnik"),
    sg("a10-3", "a10", "10.3", "Zentrale Dienste"),
    amt("a11", "d1", "11", "Personalamt"),
    sg("a11-1", "a11", "11.1", "Personalverwaltung"),
    sg("a11-2", "a11", "11.2", "Personalentwicklung"),
    amt("a12", "d1", "12", "Statistik und Wahlen"),
    dez("d2", "II", "Finanzen", "Aufgabenhauptgruppe 2"),
    amt("a20", "d2", "20", "Kämmerei"),
    sg("a20-1", "a20", "20.1", "Haushalt"),
    sg("a20-2", "a20", "20.2", "Controlling"),
    amt("a21", "d2", "21", "Stadtkasse"),
    amt("a22", "d2", "22", "Steueramt"),
    amt("a23", "d2", "23", "Liegenschaftsamt"),
    dez("d3", "III", "Recht, Sicherheit und Ordnung", "Aufgabenhauptgruppe 3"),
    amt("a30", "d3", "30", "Rechtsamt"),
    amt("a32", "d3", "32", "Ordnungsamt"),
    amt("a33", "d3", "33", "Bürgeramt"),
    amt("a37", "d3", "37", "Feuerwehr"),
    sg("a37-1", "a37", "37.1", "Einsatz und Rettungsdienst"),
    sg("a37-2", "a37", "37.2", "Vorbeugender Brandschutz"),
    dez("d4", "IV", "Schule und Kultur", "Aufgabenhauptgruppe 4"),
    amt("a40", "d4", "40", "Schulverwaltungsamt"),
    amt("a41", "d4", "41", "Kulturamt"),
    amt("a42", "d4", "42", "Stadtbibliothek"),
    dez("d5", "V", "Soziales, Jugend und Gesundheit", "Aufgabenhauptgruppe 5"),
    amt("a50", "d5", "50", "Sozialamt"),
    amt("a51", "d5", "51", "Jugendamt"),
    sg("a51-1", "a51", "51.1", "Allgemeiner Sozialer Dienst"),
    sg("a51-2", "a51", "51.2", "Kindertagesbetreuung"),
    sg("a51-3", "a51", "51.3", "Wirtschaftliche Jugendhilfe"),
    amt("a52", "d5", "52", "Sportamt"),
    amt("a53", "d5", "53", "Gesundheitsamt"),
    dez("d6", "VI", "Bauwesen", "Aufgabenhauptgruppe 6"),
    amt("a61", "d6", "61", "Stadtplanungsamt"),
    amt("a63", "d6", "63", "Bauordnungsamt"),
    amt("a65", "d6", "65", "Hochbauamt"),
    amt("a66", "d6", "66", "Tiefbauamt"),
    amt("a67", "d6", "67", "Grünflächenamt"),
  ],
  [
    ["Verwaltungsvorstand", "committee", null, null, ["ob"], ["d1", "d2", "d3", "d4", "d5", "d6"]],
    [
      "Onlinezugang (OZG)",
      "project",
      "2024-01-01",
      "2026-12-31",
      ["a10-2"],
      ["a33", "a32", "a51-2", "a63"],
      { shortName: "OZG" },
    ],
    [
      "Einführung E-Akte",
      "project",
      "2025-04-01",
      "2027-03-31",
      ["a10-1"],
      ["a10-2", "a11-1", "a21", "a50", "a63"],
      { shortName: "E-Akte" },
    ],
    [
      "Klimaschutzkonzept",
      "project",
      "2026-01-01",
      "2027-06-30",
      ["a61"],
      ["a65", "a66", "a67", "a20-1", "a13"],
    ],
    ["Kita-Ausbau", "project", "2026-03-01", "2027-12-31", ["a51-2"], ["a65", "a23", "a20-1"]],
    ["Schulsanierung", "project", "2025-01-01", "2028-12-31", ["a65"], ["a40", "a20-2"]],
    ["Krisenstab", "committee", null, null, ["ob"], ["d3", "a37", "a53", "a13", "a10-2"]],
    ["Personalentwicklung", "crossCutting", null, null, ["a11-2"], ["a10-1", "gst"]],
    [
      "Haushaltskonsolidierung",
      "project",
      "2024-01-01",
      "2025-12-31",
      ["a20-1"],
      ["d1", "d2", "d3", "d4", "d5", "d6"],
    ],
  ],
  [
    ["a14", "ob", "reportsTo", "unabhängig, dem Rat zugeordnet"],
    ["a10-2", "a10-1", "coordinates"],
    ["a20", "d6", "directs", "Haushaltsvollzug"],
    ["a37", "a53", "informs"],
    ["a13", "a37", "coordinates"],
  ],
  { tree: { orientation: "top-down", stackLeaves: true } },
);

// ---------- Einfache Firma (entspricht der Excel-Vorlage) ----------
build(
  "beispiel-firma",
  { title: "Muster GmbH", organization: "Muster GmbH" },
  ["Geschäftsführung", "Bereich", "Team"],
  [
    [
      "gf",
      null,
      "Geschäftsführung",
      {
        shortName: "GF",
        type: "Geschäftsführung",
        responsibilities: "Gesamtleitung",
        lead: { title: "Geschäftsführer", code: "GF" },
      },
    ],
    [
      "as",
      "gf",
      "Assistenz der Geschäftsführung",
      { shortName: "AS", type: "Stabsstelle", isStaff: true, responsibilities: "Termine, Gremien" },
    ],
    [
      "vt",
      "gf",
      "Vertrieb",
      {
        shortName: "VT",
        type: "Bereich",
        responsibilities: "Kunden, Angebote",
        lead: { title: "Vertriebsleitung", code: "VL" },
      },
    ],
    ["vti", "vt", "Innendienst", { shortName: "VT-I", type: "Team", lead: { title: "Teamleitung" } }],
    ["vta", "vt", "Außendienst", { shortName: "VT-A", type: "Team", lead: { title: "Teamleitung" } }],
    [
      "pr",
      "gf",
      "Produktion",
      {
        shortName: "PR",
        type: "Bereich",
        responsibilities: "Fertigung, Lager",
        lead: { title: "Produktionsleitung", code: "PL" },
      },
    ],
    ["prf", "pr", "Fertigung", { shortName: "PR-F", type: "Team", lead: { title: "Meister" } }],
    ["prl", "pr", "Lager und Versand", { shortName: "PR-L", type: "Team", lead: { title: "Teamleitung" } }],
    [
      "vw",
      "gf",
      "Verwaltung",
      { shortName: "VW", type: "Bereich", lead: { title: "Kaufmännische Leitung", code: "KL" } },
    ],
    ["bh", "vw", "Buchhaltung", { shortName: "BH", type: "Team" }],
    ["hr", "vw", "Personal", { shortName: "HR", type: "Team" }],
  ],
  [
    [
      "Neues Warenwirtschaftssystem",
      "project",
      "2026-01-01",
      "2026-12-31",
      ["vw"],
      ["bh", "prl", "vti"],
      { shortName: "WaWi" },
    ],
    ["Messeauftritt", "project", "2026-09-01", "2027-03-31", ["vt"], ["vta", "prf", "as"]],
    ["Arbeitsschutz", "crossCutting", null, null, ["hr"], ["prf", "prl"]],
  ],
  [
    ["vti", "prl", "coordinates", "Liefertermine"],
    ["bh", "gf", "reportsTo", "Monatsberichte"],
  ],
);

writeFileSync(`${OUT}beispiel-einheiten.csv`, exampleCsv());
writeFileSync(`${OUT}vorlage-struktur.xlsx`, templateXlsx());
console.log("beispiel-einheiten.csv, vorlage-struktur.xlsx");

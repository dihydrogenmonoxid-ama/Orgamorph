import assert from "node:assert/strict";
import { test } from "node:test";
import {
  addChild,
  addRelation,
  addSibling,
  addTopic,
  type Command,
  CommandRejected,
  cycleParticipant,
  deleteRelation,
  deleteTopic,
  deleteUnit,
  indentUnit,
  insertUnits,
  moveTopic,
  moveUnit,
  outdentUnit,
  pinNode,
  reparentUnit,
  setParticipant,
  updateMeta,
  updateRelation,
  updateSettings,
  updateTopic,
  updateUnit,
} from "../../src/core/commands.ts";
import { createHistory, execute, type History, undo } from "../../src/core/history.ts";
import { childrenOf, type OrgDocument } from "../../src/core/model.ts";
import { assertValid } from "../../src/core/validate.ts";
import { sampleDoc } from "../fixtures/sample.ts";

/** Führt aus, prüft Gültigkeit und dass Undo exakt den Ausgangszustand herstellt. */
function run(cmd: Command, doc: OrgDocument = sampleDoc()): { after: OrgDocument; h: History } {
  const h0 = createHistory(doc);
  const h = execute(h0, cmd, 1_000_000);
  assertValid(h.present);
  const back = undo(h).present;
  assert.deepEqual(back, doc, "Undo stellt den Ausgangszustand wieder her");
  return { after: h.present, h };
}

const names = (d: OrgDocument, parent: string | null) => childrenOf(d, parent).map((u) => u.name);

test("addChild hängt am Ende an, optional an Position", () => {
  const cmd = addChild("u_abt1000001", { name: "Referat 1.4" });
  const { after } = run(cmd);
  assert.deepEqual(names(after, "u_abt1000001"), [
    "Referat 1.1",
    "Referat 1.2",
    "Referat 1.3",
    "Referat 1.4",
  ]);
  assert.ok(cmd.createdId);
  const { after: a2 } = run(addChild("u_abt1000001", { name: "Neu" }, 0));
  assert.deepEqual(names(a2, "u_abt1000001")[0], "Neu");
});

test("Units bleiben in Tiefensuche-Reihenfolge", () => {
  const { after } = run(addChild("u_abt1000001", { name: "Referat 1.4" }));
  const ids = after.units.map((u) => u.id);
  const pos = (id: string) => ids.indexOf(id);
  for (const u of after.units) if (u.parentId) assert.ok(pos(u.parentId) < pos(u.id));
  const r14 = after.units.find((u) => u.name === "Referat 1.4")!;
  assert.ok(pos(r14.id) < pos("u_abt2000001"));
});

test("addSibling legt direkt danach an; Wurzel hat keine Geschwister", () => {
  const { after } = run(addSibling("u_ref1100001", { name: "Neu" }));
  assert.deepEqual(names(after, "u_abt1000001"), ["Referat 1.1", "Neu", "Referat 1.2", "Referat 1.3"]);
  assert.throws(
    () => execute(createHistory(sampleDoc()), addSibling("u_root000001", { name: "x" })),
    CommandRejected,
  );
});

test("updateUnit: Felder, Leitung, leere Werte entfernt, leerer Name abgelehnt", () => {
  const { after } = run(
    updateUnit("u_ref1100001", {
      shortName: "",
      lead: { title: "Referatsleitung", holder: "" },
      isStaff: false,
    }),
  );
  const u = after.units.find((x) => x.id === "u_ref1100001")!;
  assert.equal(u.shortName, undefined);
  assert.deepEqual(u.lead, { title: "Referatsleitung" });
  assert.equal("isStaff" in u, false);
  const { after: a2 } = run(
    updateUnit("u_abt1000001", { lead: { holder: "", positionNumber: "", code: "", title: "" } }),
  );
  assert.equal(a2.units.find((x) => x.id === "u_abt1000001")!.lead, undefined);
  assert.throws(
    () => execute(createHistory(sampleDoc()), updateUnit("u_ref1100001", { name: " " })),
    CommandRejected,
  );
});

test("Abnahme 4: deleteUnit entfernt Teilbaum, Beteiligungen, Beziehungen, Pins — Undo in einem Schritt", () => {
  const doc = sampleDoc();
  doc.view.network.pinned.u_ref1100001 = { x: 1, y: 2 };
  const { after, h } = run(deleteUnit("u_abt1000001"), doc);
  assert.equal(h.past.length, 1);
  assert.ok(
    !after.units.some((u) => ["u_abt1000001", "u_ref1100001", "u_ref1200001", "u_ref1300001"].includes(u.id)),
  );
  assert.deepEqual(
    after.topics[0]!.participants.map((p) => p.unitId),
    ["u_ref2100001", "u_stab000001"],
  );
  assert.ok(!after.relations.some((r) => r.id === "r_rel0000001"));
  assert.ok(!after.relations.some((r) => r.id === "r_rel0000002"));
  assert.deepEqual(after.view.network.pinned, {});
  assert.throws(() => execute(createHistory(sampleDoc()), deleteUnit("u_root000001")), CommandRejected);
});

test("indent / outdent", () => {
  const { after } = run(indentUnit("u_ref1200001"));
  assert.deepEqual(names(after, "u_ref1100001"), ["Referat 1.2"]);
  assert.deepEqual(names(after, "u_abt1000001"), ["Referat 1.1", "Referat 1.3"]);
  const { after: a2 } = run(outdentUnit("u_ref1100001"));
  assert.deepEqual(names(a2, "u_root000001"), ["Stab", "Abteilung 1", "Referat 1.1", "Abteilung 2"]);
  const h = createHistory(sampleDoc());
  assert.throws(() => execute(h, indentUnit("u_ref1100001")), CommandRejected);
  assert.throws(() => execute(h, outdentUnit("u_abt1000001")), CommandRejected);
  assert.throws(() => execute(h, outdentUnit("u_root000001")), CommandRejected);
});

test("moveUnit ändert die Geschwisterreihenfolge, Grenzen werden abgelehnt", () => {
  const { after } = run(moveUnit("u_ref1300001", -1));
  assert.deepEqual(names(after, "u_abt1000001"), ["Referat 1.1", "Referat 1.3", "Referat 1.2"]);
  const { after: a2 } = run(moveUnit("u_ref1100001", 1));
  assert.deepEqual(names(a2, "u_abt1000001"), ["Referat 1.2", "Referat 1.1", "Referat 1.3"]);
  assert.throws(() => execute(createHistory(sampleDoc()), moveUnit("u_ref1100001", -1)), CommandRejected);
  assert.throws(() => execute(createHistory(sampleDoc()), moveUnit("u_ref1300001", 1)), CommandRejected);
});

test("reparentUnit: verschiebt, lehnt Nachfahren ab (§7.3)", () => {
  const { after } = run(reparentUnit("u_ref1100001", "u_abt2000001"));
  assert.deepEqual(names(after, "u_abt2000001"), ["Referat 2.1", "Referat 2.2", "Referat 1.1"]);
  assert.throws(
    () => execute(createHistory(sampleDoc()), reparentUnit("u_abt1000001", "u_ref1100001")),
    CommandRejected,
  );
  const same = execute(createHistory(sampleDoc()), reparentUnit("u_ref1100001", "u_abt1000001"));
  assert.equal(same.past.length, 0, "keine Änderung → kein Undo-Schritt");
});

test("insertUnits fügt Teilbaum ein, lehnt doppelte IDs ab", () => {
  const units = [
    { id: "u_neu0000001", parentId: null, name: "Neu A" },
    { id: "u_neu0000002", parentId: "u_neu0000001", name: "Neu A.1" },
  ];
  const { after } = run(insertUnits("u_abt2000001", units));
  assert.deepEqual(names(after, "u_abt2000001"), ["Referat 2.1", "Referat 2.2", "Neu A"]);
  assert.deepEqual(names(after, "u_neu0000001"), ["Neu A.1"]);
  assert.throws(
    () =>
      execute(
        createHistory(sampleDoc()),
        insertUnits("u_abt2000001", [{ id: "u_ref1100001", parentId: null, name: "x" }]),
      ),
    CommandRejected,
  );
});

test("Topics: anlegen mit freier Palettenfarbe, ändern, verschieben, löschen", () => {
  const cmd = addTopic({ title: "Neues Projekt" });
  const { after } = run(cmd);
  const t = after.topics.find((x) => x.id === cmd.createdId)!;
  assert.equal(t.color, "#CC79A7");
  assert.equal(t.type, "project");
  const { after: a2 } = run(
    updateTopic("t_digital001", { title: "Digital", period: { from: "2026-02-01", to: "" }, note: "" }),
  );
  assert.deepEqual(a2.topics[0]!.period, { from: "2026-02-01" });
  assert.equal(a2.topics[0]!.title, "Digital");
  assert.throws(
    () =>
      execute(
        createHistory(sampleDoc()),
        updateTopic("t_digital001", { period: { from: "2026-05-01", to: "2026-01-01" } }),
      ),
    CommandRejected,
  );
  const { after: a3 } = run(moveTopic("t_haushalt01", -1));
  assert.equal(a3.topics[0]!.id, "t_haushalt01");
  const doc = sampleDoc();
  doc.view.filter.hiddenTopics = ["t_digital001"];
  const { after: a4 } = run(deleteTopic("t_digital001"), doc);
  assert.equal(a4.topics.length, 2);
  assert.deepEqual(
    a4.view.filter.hiddenTopics,
    ["t_digital001"],
    "Filter bleibt, damit Undo vollständig ist",
  );
});

test("Beteiligungen: setzen, Rolle ändern, entfernen, Matrix-Zyklus", () => {
  const { after } = run(setParticipant("t_haushalt01", "u_stab000001", "member"));
  assert.equal(after.topics[1]!.participants.length, 3);
  const { after: a2 } = run(setParticipant("t_haushalt01", "u_ref1100001", "lead"));
  assert.equal(a2.topics[1]!.participants[0]!.role, "lead");
  const { after: a3 } = run(setParticipant("t_haushalt01", "u_ref1100001", null));
  assert.equal(a3.topics[1]!.participants.length, 1);

  let doc = sampleDoc();
  const roles: (string | undefined)[] = [];
  for (let i = 0; i < 4; i++) {
    doc = execute(createHistory(doc), cycleParticipant(doc.topics[1]!, "u_stab000001")).present;
    roles.push(doc.topics[1]!.participants.find((p) => p.unitId === "u_stab000001")?.role);
  }
  assert.deepEqual(roles, ["member", "lead", undefined, "member"]);
});

test("Relations: anlegen, ändern, löschen, Selbstbezug abgelehnt", () => {
  const cmd = addRelation({ from: "u_ref2200001", to: "u_ref1100001", kind: "coordinates" });
  const { after } = run(cmd);
  assert.equal(after.relations.at(-1)!.kind, "coordinates");
  const { after: a2 } = run(updateRelation("r_rel0000001", { kind: "directs", note: "" }));
  assert.equal(a2.relations[0]!.kind, "directs");
  const { after: a3 } = run(deleteRelation("r_rel0000001"));
  assert.equal(a3.relations.length, 1);
  const h = createHistory(sampleDoc());
  assert.throws(() => execute(h, addRelation({ from: "u_ref1100001", to: "u_ref1100001" })), CommandRejected);
  assert.throws(() => execute(h, updateRelation("r_rel0000001", { to: "u_ref1300001" })), CommandRejected);
  assert.throws(() => execute(h, deleteRelation("r_nix0000000")), CommandRejected);
});

test("Meta, Settings, Pins", () => {
  const { after } = run(updateMeta({ title: "Neu", organization: "" }));
  assert.equal(after.meta.title, "Neu");
  assert.equal("organization" in after.meta, false);
  const { after: a2 } = run(updateSettings({ spanOfControlHint: 5 }));
  assert.equal(a2.settings.spanOfControlHint, 5);
  assert.throws(
    () => execute(createHistory(sampleDoc()), updateSettings({ spanOfControlHint: 0 })),
    CommandRejected,
  );
  const { after: a3 } = run(pinNode("u_ref1100001", { x: 10.4, y: -3.6 }));
  assert.deepEqual(a3.view.network.pinned.u_ref1100001, { x: 10, y: -4 });
  const pinned = sampleDoc();
  pinned.view.network.pinned.u_ref1100001 = { x: 1, y: 1 };
  const { after: a4 } = run(pinNode("u_ref1100001", null), pinned);
  assert.deepEqual(a4.view.network.pinned, {});
});

test("unbekannte IDs werden abgelehnt", () => {
  const h = createHistory(sampleDoc());
  for (const cmd of [
    addChild("u_nix0000000", { name: "x" }),
    updateUnit("u_nix0000000", { name: "x" }),
    deleteUnit("u_nix0000000"),
    updateTopic("t_nix0000000", { title: "x" }),
    setParticipant("t_digital001", "u_nix0000000", "lead"),
  ])
    assert.throws(() => execute(h, cmd), CommandRejected);
});

test("insertTopics fügt Projekte in einem Schritt ein", async () => {
  const { insertTopics } = await import("../../src/core/commands.ts");
  const topic = {
    id: "t_neu0000001",
    title: "Neu",
    type: "project" as const,
    period: {},
    participants: [{ unitId: "u_ref1100001", role: "lead" as const }],
    color: "#000000",
  };
  const { after, h } = run(insertTopics([topic]));
  assert.equal(after.topics.length, 4);
  assert.equal(h.past.length, 1);
  assert.throws(
    () =>
      execute(
        createHistory(sampleDoc()),
        insertTopics([{ ...topic, participants: [{ unitId: "u_x", role: "lead" }] }]),
      ),
    CommandRejected,
  );
});

test("Regression: Umbenennen der Wurzel behält parentId: null", () => {
  const { after } = run(updateUnit("u_root000001", { name: "Neue Leitung", shortName: "" }));
  const root = after.units.find((u) => u.id === "u_root000001")!;
  assert.equal(root.parentId, null);
  assert.equal("parentId" in root, true);
});

test("Plankopf: Ersteller, Abteilung, Logo; ungültiges Logo abgelehnt", async () => {
  const png = "data:image/png;base64,iVBORw0KGgo=";
  const { after } = run(updateMeta({ author: "A. Muster", department: "Organisation", logo: png }));
  assert.deepEqual(
    [after.meta.author, after.meta.department, after.meta.logo],
    ["A. Muster", "Organisation", png],
  );
  const { after: a2 } = run(updateMeta({ author: "", logo: "" }), after);
  assert.equal("author" in a2.meta, false);
  assert.equal("logo" in a2.meta, false);
  for (const bad of [
    "data:text/html;base64,AAAA",
    "javascript:alert(1)",
    `data:image/png;base64,${"A".repeat(400_001)}`,
  ])
    assert.throws(() => execute(createHistory(sampleDoc()), updateMeta({ logo: bad })), CommandRejected);
  const { serialize, parse } = await import("../../src/core/io/json.ts");
  const text = serialize(after);
  assert.deepEqual(Object.keys(JSON.parse(text).meta), [
    "title",
    "department",
    "author",
    "created",
    "modified",
    "logo",
  ]);
  assert.deepEqual(parse(text).doc.meta, after.meta);
});

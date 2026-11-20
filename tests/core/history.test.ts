import assert from "node:assert/strict";
import { test } from "node:test";
import { addChild, pinNode, updateUnit } from "../../src/core/commands.ts";
import {
  canRedo,
  canUndo,
  createHistory,
  execute,
  HISTORY_LIMIT,
  redo,
  setView,
  undo,
} from "../../src/core/history.ts";
import { sampleDoc } from "../fixtures/sample.ts";

test("Undo/Redo-Grundablauf, Redo verfällt nach neuer Änderung", () => {
  let h = createHistory(sampleDoc());
  assert.ok(!canUndo(h) && !canRedo(h));
  h = execute(h, addChild("u_abt1000001", { name: "A" }), 0);
  h = execute(h, addChild("u_abt1000001", { name: "B" }), 5000);
  assert.equal(h.present.units.length, 11);
  h = undo(h);
  assert.equal(h.present.units.length, 10);
  assert.ok(canRedo(h));
  h = redo(h);
  assert.equal(h.present.units.length, 11);
  h = undo(undo(h));
  assert.equal(h.present.units.length, 9);
  h = execute(h, addChild("u_abt1000001", { name: "C" }), 9000);
  assert.ok(!canRedo(h));
});

test("Tippen im selben Feld innerhalb 1 s = ein Schritt", () => {
  let h = createHistory(sampleDoc());
  h = execute(h, updateUnit("u_ref1100001", { name: "R" }), 1000);
  h = execute(h, updateUnit("u_ref1100001", { name: "Re" }), 1500);
  h = execute(h, updateUnit("u_ref1100001", { name: "Ref" }), 2400);
  assert.equal(h.past.length, 1);
  h = execute(h, updateUnit("u_ref1100001", { name: "Ref X" }), 3500);
  assert.equal(h.past.length, 2, "Pause > 1 s → neuer Schritt");
  h = execute(h, updateUnit("u_ref1100001", { shortName: "RX" }), 3600);
  assert.equal(h.past.length, 3, "anderes Feld → neuer Schritt");
  h = undo(h);
  assert.equal(h.present.units.find((u) => u.id === "u_ref1100001")!.name, "Ref X");
});

test("Obergrenze 300 Schritte", () => {
  let h = createHistory(sampleDoc());
  for (let i = 0; i < HISTORY_LIMIT + 20; i++)
    h = execute(h, addChild("u_root000001", { name: `N${i}` }), i * 2000);
  assert.equal(h.past.length, HISTORY_LIMIT);
  assert.equal(h.pastLabels.length, HISTORY_LIMIT);
});

test("Undo betrifft nicht Sicht und Filter, aber angeheftete Positionen", () => {
  let h = createHistory(sampleDoc());
  h = execute(h, pinNode("u_ref1100001", { x: 5, y: 5 }), 0);
  h = setView(h, (v) => {
    v.mode = "network";
    v.filter.focusUnitId = "u_abt1000001";
  });
  assert.equal(h.past.length, 1, "Sichtänderung ist kein Undo-Schritt");
  h = undo(h);
  assert.equal(h.present.view.mode, "network");
  assert.equal(h.present.view.filter.focusUnitId, "u_abt1000001");
  assert.deepEqual(h.present.view.network.pinned, {});
  h = redo(h);
  assert.deepEqual(h.present.view.network.pinned, { u_ref1100001: { x: 5, y: 5 } });
  assert.equal(h.present.view.mode, "network");
});

test("modified wird gesetzt, Labels werden geführt", () => {
  let h = createHistory(sampleDoc());
  h = execute(h, addChild("u_root000001", { name: "X" }), Date.UTC(2026, 10, 17, 12));
  assert.equal(h.present.meta.modified, "2026-11-17T12:00:00.000Z");
  assert.deepEqual(h.pastLabels, ["addUnit"]);
  h = undo(h);
  assert.deepEqual(h.futureLabels, ["addUnit"]);
  assert.equal(undo(h), h);
  assert.equal(redo(redo(h)).past.length, 1);
});

test("strukturelles Teilen: unveränderte Teile bleiben identisch", () => {
  const h0 = createHistory(sampleDoc());
  const h1 = execute(h0, updateUnit("u_ref1100001", { name: "X" }), 0);
  assert.equal(h1.present.topics, h0.present.topics);
  assert.equal(h1.present.units[0], h0.present.units[0]);
});

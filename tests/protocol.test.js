import { test } from "node:test";
import assert from "node:assert/strict";

import { evaluateItem, sectionItems, summarizeSession } from "../js/checks.js";
import { LINACS, findLinac } from "../js/linacs/index.js";
import { buildProtocol } from "../js/protocol.js";
import { createSession } from "../js/store.js";

const protocol = buildProtocol(findLinac("linac4"));
const sections = protocol.groups.flatMap((group) => group.sections);
const section = (id) => sections.find((candidate) => candidate.id === id);
const item = (id) => sections.flatMap(sectionItems).find((candidate) => candidate.id === id);
const judgedCount = (id) => sectionItems(section(id)).filter((candidate) => candidate.rule).length;

test("groups follow the workbook's sheets: 2. Allmänt, 3. 6 MV, 4. 10 MV, 5. 15 MV, 6. 6 MV FFF", () => {
  assert.deepEqual(
    protocol.groups.map((group) => `${group.number}. ${group.title}`),
    ["2. Allmänt", "3. 6 MV fotoner", "4. 10 MV fotoner", "5. 15 MV fotoner", "6. 6 MV FFF fotoner"],
  );
  assert.deepEqual(
    protocol.groups[4].sections.map((candidate) => candidate.number),
    ["6.1", "6.2"], // no dynamic wedges for FFF
  );
});

test("every pass/fail cell of the Linac 4 workbook has a check", () => {
  // Counted from the workbook's OK/Underkänd formulas, per section.
  const expected = { "2.1": 6, "2.2": 7, "2.3": 13, "2.4": 6, "2.5": 3, "2.6": 4 };
  for (const [id, count] of Object.entries(expected)) assert.equal(judgedCount(id), count, id);
  for (const beam of ["6x", "10x", "15x", "6fff"]) {
    assert.equal(judgedCount(`${beam}.field`), 14, `${beam} field`); // 2 depth dose, 4 penumbra, 4 position, 2 symmetry, 2 flatness
    assert.equal(judgedCount(`${beam}.output`), 2, `${beam} output`);
  }
  for (const beam of ["6x", "10x", "15x"]) assert.equal(judgedCount(`${beam}.wedges`), 8, `${beam} wedges`);
  const total = sections.reduce((sum, candidate) => sum + judgedCount(candidate.id), 0);
  assert.equal(total, 127);
});

test("storage keys are unique across the whole check", () => {
  const items = sections.flatMap(sectionItems);
  const ids = items.map((candidate) => candidate.id);
  assert.equal(new Set(ids).size, ids.length);
  const keys = items.flatMap((candidate) => candidate.fields.map((field) => field.key));
  assert.equal(new Set(keys).size, keys.length);
  const sectionIds = sections.map((candidate) => candidate.id);
  assert.equal(new Set(sectionIds).size, sectionIds.length);
});

test("every rule has finite numbers", () => {
  for (const candidate of sections.flatMap(sectionItems)) {
    const { rule } = candidate;
    if (!rule || rule.type === "ok") continue;
    for (const key of ["max", "ref", "tol"]) {
      if (key in rule) assert.ok(Number.isFinite(rule[key]), `${candidate.id} ${key}`);
    }
  }
});

test("reference values match the Linac 4 workbook (spot checks)", () => {
  assert.deepEqual(item("6x.dd.dmax10").rule, { type: "rel", ref: 1.545, tol: 0.01 }); // J9, J10
  assert.deepEqual(item("15x.dd.d2010").rule, { type: "rel", ref: 0.635, tol: 0.01 }); // S9, S10
  assert.deepEqual(item("10x.pen.minusY").rule, { type: "diff", ref: 5.2, tol: 1 }); // AJ16, AJ17
  assert.deepEqual(item("6fff.star.flatXY").rule, { type: "diff", ref: 156, tol: 2 }); // AB30, AB31
  assert.deepEqual(item("6x.pos.minusX").rule, { type: "diff", ref: -50, tol: 1 }); // K20, K21
  assert.deepEqual(item("10x.wedge.y1_60").rule, { type: "rel", ref: 0.478, tol: 0.02 }); // AI51, AJ51
  assert.deepEqual(item("2.5.d80").rule, { type: "diff", ref: 80, tol: 0.3 }); // E58
  assert.deepEqual(item("2.3.wl6.r").rule, { type: "max", max: 1.5 }); // E39
  assert.equal(item("6fff.star.flatXY").label, "OAR X=Y");
});

test("the Y1-0° dose-gradient reference is the inverse of Y2-180°, like Referensvärden!K56 = 1/K57", () => {
  assert.equal(item("6x.gradient.y2_15").rule.ref, 1.1445);
  assert.ok(Math.abs(item("6x.gradient.y1_15").rule.ref - 0.873743993010048) < 1e-12);
});

test("wedge factor and dose gradient are computed as on the beam's sheet", () => {
  const values = {
    "6x.wedge.open": "100",
    "6x.wedge.y1_15": "82,3",
    "6x.gradient.open.minus": "101",
    "6x.gradient.open.plus": "100",
    "6x.gradient.y2_15.minus": "115,6",
    "6x.gradient.y2_15.plus": "100",
  };
  const factor = evaluateItem(item("6x.wedge.y1_15"), values);
  assert.ok(Math.abs(factor.value - 0.823) < 1e-12);
  assert.equal(factor.status, "ok");

  // F63 = D63/E63/$F$61 = 1.156 / 1.01 = 1.14455…, 0.004 % from 1.1445
  const gradient = evaluateItem(item("6x.gradient.y2_15"), values);
  assert.ok(Math.abs(gradient.value - 1.156 / 1.01) < 1e-12);
  assert.equal(gradient.status, "ok");
});

test("table misalignment R is √(X² + Y²), like 2. Allmänt!E41", () => {
  const r = item("2.3.wl6.tableR");
  assert.equal(evaluateItem(r, { "2.3.wl6.tableX": "0,6", "2.3.wl6.tableY": "-0,8" }).value, 1);
  assert.equal(evaluateItem(r, { "2.3.wl6.tableX": "1", "2.3.wl6.tableY": "1.2" }).status, "fail"); // 1.56 > 1.5
  assert.equal(evaluateItem(r, { "2.3.wl6.tableX": "1" }).status, "empty");
});

test("a fully passing session is Godkänd; skipping output and wedges does not change that", () => {
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  for (const candidate of sections.flatMap(sectionItems)) {
    for (const field of candidate.fields) session.values[field.key] = passingValue(candidate, field);
  }
  assert.equal(summarizeSession(protocol, session).status, "ok");

  session.skipped["6x.output"] = true;
  session.skipped["10x.wedges"] = true;
  const summary = summarizeSession(protocol, session);
  assert.equal(summary.status, "ok");
  // Required checks only: 127, minus the four optional second output readings, minus the one
  // required reading of the skipped 6 MV output, minus the eight skipped 10 MV wedge checks.
  assert.equal(summary.total, 127 - 4 - 1 - 8);

  session.values["2.1.pin"] = "0,6";
  assert.equal(summarizeSession(protocol, session).status, "fail");
});

// A value that passes: the reference itself, zero deviation, OK, or equal readings for ratios.
function passingValue(candidate, field) {
  if (field.kind === "choice") return "OK";
  if (field.kind === "text") return "1234";
  const { rule } = candidate;
  if (candidate.derive) {
    // Wedge readings are reading/open = ref with open = 100; gradients use minus/plus = ref with plus = 100.
    if (field.key.endsWith(".plus")) return "100";
    if (field.key.endsWith(".minus")) return String((rule?.ref ?? 1) * 100);
    return String(rule.ref * 100);
  }
  if (!rule) return "100";
  if (rule.type === "max") return "0";
  return String(rule.ref);
}

test("every registered linac builds a protocol", () => {
  for (const linac of LINACS) assert.ok(buildProtocol(linac).groups.length > 1, linac.id);
});

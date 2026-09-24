import { test } from "node:test";
import assert from "node:assert/strict";

import { combineStatuses, derive, evaluateItem, judge, parseNumber, summarizeSection } from "../js/checks.js";

test("parseNumber reads what a phone keyboard types", () => {
  assert.equal(parseNumber("0,5"), 0.5); // decimal comma
  assert.equal(parseNumber("0.5"), 0.5);
  assert.equal(parseNumber(" -50,2 "), -50.2);
  assert.equal(parseNumber("−50.2"), -50.2); // typographic minus
  assert.equal(parseNumber(".5"), 0.5);
  assert.equal(parseNumber("5,"), 5); // mid-typing
  assert.equal(parseNumber("+3"), 3);
});

test("parseNumber tells nothing typed apart from not a number", () => {
  assert.equal(parseNumber(""), null);
  assert.equal(parseNumber("   "), null);
  assert.equal(parseNumber(undefined), null);
  assert.equal(parseNumber("-"), null); // the ± key tapped on an empty field
  assert.ok(Number.isNaN(parseNumber("abc")));
  assert.ok(Number.isNaN(parseNumber("1.2.3")));
  assert.ok(Number.isNaN(parseNumber("0,5 mm")));
});

test("max rule: |value| ≤ max, like =ABS(E6)<=Referensvärden!E6", () => {
  const rule = { type: "max", max: 0.5 };
  assert.equal(judge(rule, 0.5).status, "ok");
  assert.equal(judge(rule, -0.5).status, "ok");
  assert.equal(judge(rule, 0.51).status, "fail");
  assert.equal(judge(rule, null).status, "empty");
  assert.equal(judge(rule, NaN).status, "invalid");
});

test("diff rule: |value − ref| ≤ tol, including exactly on the tolerance", () => {
  // 120.3 − 120 is 0.30000000000001137 in floating point; the workbook stores 0.30000001 to pass it.
  const distance = { type: "diff", ref: 120, tol: 0.3 };
  assert.equal(judge(distance, 120.3).status, "ok");
  assert.equal(judge(distance, 119.7).status, "ok");
  assert.equal(judge(distance, 120.31).status, "fail");

  const position = { type: "diff", ref: -50, tol: 1 };
  assert.equal(judge(position, -50.8).status, "ok");
  assert.equal(judge(position, 50.8).status, "fail"); // the minus forgotten
  assert.ok(Math.abs(judge(position, -50.8).deviation - -0.8) < 1e-12);
});

test("rel rule: |value / ref − 1| ≤ tol, like =ABS(C10/Referensvärden!J9-1)<=J10", () => {
  const d2010 = { type: "rel", ref: 0.559, tol: 0.01 };
  assert.equal(judge(d2010, 0.564).status, "ok"); // +0.89 %
  assert.equal(judge(d2010, 0.566).status, "fail"); // +1.25 %
  const dose = { type: "rel", ref: 1, tol: 0.02 };
  assert.equal(judge(dose, 1.02).status, "ok"); // exactly 2 % (1.02/1 − 1 = 0.020000000000000018)
  assert.equal(judge(dose, 0.98).status, "ok");
  assert.equal(judge(dose, 1.021).status, "fail");
  assert.equal(judge(dose, Infinity).status, "invalid"); // a division by a zero reading
});

test("ok rule: the OK / Ej OK list", () => {
  const rule = { type: "ok" };
  assert.equal(judge(rule, "OK").status, "ok");
  assert.equal(judge(rule, "Ej OK").status, "fail");
  assert.equal(judge(rule, "").status, "empty");
  assert.equal(judge(rule, null).status, "empty");
});

test("derive waits for missing inputs and flags bad ones", () => {
  const ratio = (a, b) => a / b;
  assert.equal(derive([82.3, 100], ratio), 0.823);
  assert.equal(derive([82.3, null], ratio), null);
  assert.ok(Number.isNaN(derive([82.3, NaN], ratio)));
});

const pin = {
  id: "pin",
  label: "Isoc.pinne",
  unit: "mm",
  rule: { type: "max", max: 0.5 },
  fields: [{ key: "pin", kind: "number" }],
};
const wedgeFactor = {
  id: "wf",
  label: "Y1-0°, 15° kil",
  unit: "",
  rule: { type: "rel", ref: 0.823, tol: 0.01 },
  fields: [{ key: "wf", kind: "number" }],
  derive: (read) => derive([read("wf"), read("open")], (reading, open) => reading / open),
};

test("evaluateItem judges a typed value", () => {
  assert.equal(evaluateItem(pin, { pin: "0,4" }).status, "ok");
  assert.equal(evaluateItem(pin, { pin: "0,6" }).status, "fail");
  assert.equal(evaluateItem(pin, {}).status, "empty");
  assert.equal(evaluateItem(pin, { pin: "x" }).status, "invalid");
});

test("evaluateItem computes a derived value and says when it is still waiting", () => {
  const passed = evaluateItem(wedgeFactor, { wf: "82,5", open: "100" });
  assert.equal(passed.status, "ok");
  assert.equal(passed.value, 0.825);

  const waiting = evaluateItem(wedgeFactor, { wf: "82,5" });
  assert.equal(waiting.status, "empty");
  assert.equal(waiting.touched, true);

  assert.equal(evaluateItem(wedgeFactor, { wf: "84", open: "100" }).status, "fail"); // +2.1 %
});

const section = {
  id: "s",
  blocks: [
    {
      items: [
        pin,
        { ...pin, id: "pin2", fields: [{ key: "pin2", kind: "number" }] },
        { ...pin, id: "extra", optional: true, fields: [{ key: "extra", kind: "number" }] },
        { id: "note", label: "Detektor", unit: "", rule: null, fields: [{ key: "note", kind: "text" }] },
      ],
    },
  ],
};

test("a section is Godkänd once every required check passes", () => {
  const summary = summarizeSection(section, { pin: "0.1", pin2: "0.2" });
  assert.equal(summary.status, "ok");
  assert.equal(summary.done, 2);
  assert.equal(summary.total, 2); // the optional check and the text field do not count
});

test("a section is Underkänd when any check fails, even an optional one", () => {
  assert.equal(summarizeSection(section, { pin: "0.1", pin2: "0.9" }).status, "fail");
  assert.equal(summarizeSection(section, { pin: "0.1", pin2: "0.2", extra: "0.7" }).status, "fail");
  assert.equal(summarizeSection(section, { pin: "0.9" }).status, "fail"); // before the rest is filled in
});

test("a section is open while checks are missing or unreadable, todo when untouched", () => {
  assert.equal(summarizeSection(section, {}).status, "todo");
  assert.equal(summarizeSection(section, { pin: "0.1" }).status, "open");
  assert.equal(summarizeSection(section, { pin: "0.1", pin2: "0.2", extra: "abc" }).status, "open");
});

test("a skipped section says so whatever was typed", () => {
  assert.equal(summarizeSection(section, { pin: "0.9" }, true).status, "skipped");
});

test("combineStatuses: any fail wins, skipped sections never hold the verdict back", () => {
  assert.equal(combineStatuses(["ok", "fail", "open"]), "fail");
  assert.equal(combineStatuses(["ok", "skipped", "ok"]), "ok");
  assert.equal(combineStatuses(["ok", "todo"]), "open");
  assert.equal(combineStatuses(["todo", "todo", "skipped"]), "todo");
  assert.equal(combineStatuses(["skipped"]), "skipped");
});

// Pass/fail logic for the yearly check. Pure functions only: no DOM, so the Node tests can
// import this file (CLAUDE.md › Architecture).

// Slack for comparing a value that sits exactly on the tolerance. 120.3 cm − 120 cm is
// 0.30000000000001137 in floating point and would fail a 0.3 cm tolerance; the workbook dodges
// the same trap by storing that tolerance as 0.30000001 (Referensvärden!E58).
const EPSILON = 1e-9;

/**
 * Reads a typed number. Accepts a decimal comma (`0,5`) and a typographic minus (`−50`).
 * Returns null when nothing (or only a sign) is typed, and NaN when the text is not a number.
 */
export function parseNumber(text) {
  if (text === undefined || text === null) return null;
  const normalized = String(text)
    .replace(/\s+/g, "")
    .replace(",", ".")
    .replace(/[−–]/g, "-");
  if (normalized === "" || normalized === "-" || normalized === "+") return null;
  if (!/^[+-]?(\d+\.?\d*|\.\d+)$/.test(normalized)) return NaN;
  return Number(normalized);
}

/**
 * Computes a derived value (a wedge factor, a dose ratio) from numbers that may not be typed
 * yet: null while any input is missing, NaN if any input is not a number.
 */
export function derive(inputs, compute) {
  if (inputs.some((value) => value === null)) return null;
  if (inputs.some((value) => Number.isNaN(value))) return NaN;
  return compute(...inputs);
}

/**
 * Judges one value against a rule. The rule types mirror the workbook's formulas:
 *
 *   max   |value| ≤ max              =IF(ABS(E6)<=Referensvärden!E6, "OK", "Underkänd")
 *   diff  |value − ref| ≤ tol        =IF(ABS(C18-Referensvärden!J16)<=Referensvärden!J17, …)
 *   rel   |value / ref − 1| ≤ tol    =IF(ABS(C10/Referensvärden!J9-1)<=Referensvärden!J10, …)
 *   ok    value is "OK"              the OK / Ej OK list in 2. Allmänt!E70:E73
 *
 * Returns { status, deviation }: status is "empty", "invalid", "ok" or "fail"; deviation is
 * value − ref for diff, value / ref − 1 for rel, and null otherwise.
 */
export function judge(rule, value) {
  if (rule.type === "ok") {
    if (value === null || value === undefined || value === "") return { status: "empty", deviation: null };
    return { status: value === "OK" ? "ok" : "fail", deviation: null };
  }
  if (value === null || value === undefined) return { status: "empty", deviation: null };
  if (!Number.isFinite(value)) return { status: "invalid", deviation: null };

  switch (rule.type) {
    case "max":
      return verdict(Math.abs(value) <= rule.max + EPSILON, null);
    case "diff": {
      const deviation = value - rule.ref;
      return verdict(Math.abs(deviation) <= rule.tol + EPSILON, deviation);
    }
    case "rel": {
      const deviation = value / rule.ref - 1;
      return verdict(Math.abs(deviation) <= rule.tol + EPSILON, deviation);
    }
    default:
      throw new Error(`Unknown rule type: ${rule.type}`);
  }
}

function verdict(passed, deviation) {
  return { status: passed ? "ok" : "fail", deviation };
}

/**
 * The value of one check and its verdict. `values` maps field keys to the text that was typed.
 * `touched` says whether anything was typed into the check's own fields, so a wedge factor
 * waiting for its open-field reading can say so instead of looking untouched.
 */
export function evaluateItem(item, values) {
  const read = (key) => parseNumber(values[key]);
  const touched = item.fields.some((field) => String(values[field.key] ?? "").trim() !== "");

  if (item.rule?.type === "ok") {
    const choice = values[item.fields[0].key] || null;
    return { value: choice, touched, ...judge(item.rule, choice) };
  }

  let value;
  if (item.derive) value = item.derive(read);
  else if (item.fields[0].kind === "text") value = String(values[item.fields[0].key] ?? "").trim() || null;
  else value = read(item.fields[0].key);

  if (!item.rule) {
    let status = "info";
    if (value === null) status = "empty";
    else if (typeof value === "number" && !Number.isFinite(value)) status = "invalid";
    return { value, touched, status, deviation: null };
  }
  return { value, touched, ...judge(item.rule, value) };
}

/** Every check in a section, in order. */
export function sectionItems(section) {
  return section.blocks.flatMap((block) => block.items);
}

/**
 * Rolls one section up the way the workbook's Sammanfattning does: Underkänd if any check
 * fails, Godkänd once every required check passes. Optional checks (the second output
 * reading) count when filled in but never hold a section back.
 *
 * status: "skipped" | "fail" | "ok" | "open" (partly done) | "todo" (nothing typed)
 */
export function summarizeSection(section, values, skipped = false) {
  const results = sectionItems(section).map((item) => ({ item, ...evaluateItem(item, values) }));
  const judged = results.filter((result) => result.item.rule);
  const required = judged.filter((result) => !result.item.optional);
  const failed = judged.filter((result) => result.status === "fail");
  const invalid = judged.some((result) => result.status === "invalid");
  const done = required.filter((result) => result.status === "ok" || result.status === "fail").length;
  const touched = results.some((result) => result.touched);

  let status;
  if (skipped) status = "skipped";
  else if (failed.length > 0) status = "fail";
  else if (done === required.length && !invalid) status = "ok";
  else status = touched ? "open" : "todo";

  return { section, results, status, done, total: required.length, failed };
}

/** Combines section statuses into one for a beam, for the whole check, or for a nav tab. */
export function combineStatuses(statuses) {
  if (statuses.includes("fail")) return "fail";
  const active = statuses.filter((status) => status !== "skipped");
  if (active.length === 0) return statuses.length > 0 ? "skipped" : "todo";
  if (active.every((status) => status === "ok")) return "ok";
  return active.every((status) => status === "todo") ? "todo" : "open";
}

/** Summaries for every section of a protocol, grouped as the protocol is, plus the overall verdict. */
export function summarizeSession(protocol, session) {
  const groups = protocol.groups.map((group) => {
    const sections = group.sections.map((section) =>
      summarizeSection(section, session.values, Boolean(session.skipped[section.id])),
    );
    return { group, sections, status: combineStatuses(sections.map((summary) => summary.status)) };
  });
  const sections = groups.flatMap((group) => group.sections);
  const active = sections.filter((summary) => summary.status !== "skipped");
  return {
    groups,
    status: combineStatuses(sections.map((summary) => summary.status)),
    done: active.reduce((sum, summary) => sum + summary.done, 0),
    total: active.reduce((sum, summary) => sum + summary.total, 0),
    failed: active.flatMap((summary) => summary.failed.map((result) => ({ ...result, section: summary.section }))),
  };
}

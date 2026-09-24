// How numbers, rules and verdicts read on screen and in the report. Pure functions, no DOM.

export const SECTION_STATUS_TEXT = {
  ok: "Godkänd",
  fail: "Underkänd",
  skipped: "Ej utförd",
  open: "Ej komplett",
  todo: "Ej påbörjad",
};

export const CHECK_STATUS_TEXT = {
  ok: "OK",
  fail: "Underkänd",
  invalid: "Ogiltigt",
  empty: "",
  info: "",
};

const MINUS = "−";

/** A number with at most `digits` decimals, trailing zeros dropped, and a typographic minus. */
export function formatNumber(value, digits = 4) {
  if (value === null || value === undefined || !Number.isFinite(value)) return "—";
  const rounded = Number(value.toFixed(digits));
  const text = String(Object.is(rounded, -0) ? 0 : rounded);
  return text.replace("-", MINUS);
}

/** What was typed, tidied for display: decimal point, typographic minus. */
export function formatTyped(text) {
  return String(text ?? "")
    .trim()
    .replace(",", ".")
    .replace(/^-/, MINUS);
}

/** Appends a unit: "0.5 mm", "0.5°", or the bare number when there is no unit. */
export function withUnit(text, unit) {
  if (!unit) return text;
  return unit === "°" ? `${text}°` : `${text} ${unit}`;
}

/** Reference and tolerance as they read in the form and the report. */
export function describeRule(rule, unit) {
  if (!rule) return { ref: "", tol: "" };
  switch (rule.type) {
    case "max":
      return { ref: "", tol: `≤ ${withUnit(formatNumber(rule.max), unit)}` };
    case "diff":
      return { ref: withUnit(formatNumber(rule.ref), unit), tol: `±${withUnit(formatNumber(rule.tol), unit)}` };
    case "rel":
      return { ref: withUnit(formatNumber(rule.ref), unit), tol: `±${formatNumber(rule.tol * 100, 2)} %` };
    case "ok":
      return { ref: "", tol: "OK" };
    default:
      return { ref: "", tol: "" };
  }
}

/** The deviation from the reference: "+0.3 mm" for diff rules, "−1.25 %" for rel rules. */
export function describeDeviation(rule, deviation, unit) {
  if (!rule || deviation === null || deviation === undefined || !Number.isFinite(deviation)) return "";
  const signed = (value, digits) => {
    const text = formatNumber(value, digits);
    return value > 0 && text !== "0" ? `+${text}` : text;
  };
  if (rule.type === "rel") return `${signed(deviation * 100, 2)} %`;
  if (rule.type === "diff") return withUnit(signed(deviation, 2), unit);
  return "";
}

/** A check's value for display: the derived value if it has one, else what was typed. */
export function describeValue(item, result, values) {
  if (item.derive) return result.value === null ? "" : withUnit(formatNumber(result.value, item.digits ?? 4), item.unit);
  if (item.rule?.type === "ok" || item.fields[0].kind === "text") return result.value ?? "";
  const typed = values[item.fields[0].key];
  return typed ? withUnit(formatTyped(typed), item.unit) : "";
}

export function escapeHtml(text) {
  return String(text ?? "")
    .replace(/&/g, "&amp;")
    .replace(/</g, "&lt;")
    .replace(/>/g, "&gt;")
    .replace(/"/g, "&quot;")
    .replace(/'/g, "&#39;");
}

/** Today's date as YYYY-MM-DD in local time (not UTC, which is yesterday before 02:00 in summer). */
export function localDate(date = new Date()) {
  const pad = (n) => String(n).padStart(2, "0");
  return `${date.getFullYear()}-${pad(date.getMonth() + 1)}-${pad(date.getDate())}`;
}

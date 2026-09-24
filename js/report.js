// The printable report: an HTML string built from a session and its summary. No DOM, so the
// tests can check it; app.js puts it on the page and calls window.print() (CLAUDE.md › UI conventions).

import { INSTRUCTION, RESULT_NOTE } from "./protocol.js";
import {
  CHECK_STATUS_TEXT,
  SECTION_STATUS_TEXT,
  describeDeviation,
  describeRule,
  describeValue,
  escapeHtml,
  formatTyped,
} from "./format.js";

/** The report's title, also used as the suggested PDF file name. */
export function reportTitle(linac, session) {
  return `Årskontroll ${linac.name} ${session.date}`.trim();
}

export function buildReport(protocol, session, summary, generatedAt = new Date()) {
  const { linac } = protocol;
  const year = (session.date || "").slice(0, 4);
  return `
<article class="report">
  <header class="report-header">
    <div>
      <p class="report-kicker">Årskontroll${year ? ` ${escapeHtml(year)}` : ""}</p>
      <h1>${escapeHtml(linac.name)} <span>${escapeHtml(linac.model)}</span></h1>
    </div>
    <div class="report-verdict tag--${summary.status}">${SECTION_STATUS_TEXT[summary.status]}</div>
  </header>

  <dl class="report-meta">
    ${metaRow("Datum", session.date)}
    ${metaRow("Kontrollen utförd av", session.performer)}
    ${metaRow("Tel.nr", session.phone)}
    ${metaRow("Instruktion", `${INSTRUCTION.title}, dokumentnr ${INSTRUCTION.number}, utgåva ${INSTRUCTION.edition}`)}
  </dl>

  <section class="report-section">
    <h2>Sammanfattning</h2>
    <table class="report-table report-summary">
      <thead><tr><th>Kontroll</th><th>Resultat</th><th>Kommentar</th></tr></thead>
      <tbody>
        ${summary.groups.map((groupSummary) => summaryRows(groupSummary, session)).join("")}
      </tbody>
    </table>
    <p class="report-count">${countLine(summary)}</p>
  </section>

  <section class="report-section">
    <h2>Kommentarer</h2>
    <p class="report-text">${escapeHtml(session.notes.trim()) || "—"}</p>
  </section>

  <section class="report-section">
    <h2>Åtgärder att utföra efter besiktning</h2>
    ${actionsTable(session.actions)}
  </section>

  <section class="report-section">
    <h2>Resultat</h2>
    ${summary.groups.map((groupSummary) => groupDetails(groupSummary, session)).join("")}
  </section>

  <section class="report-section report-closing">
    <p class="report-note">${escapeHtml(RESULT_NOTE)}</p>
    <div class="report-signature">
      <div><span class="report-line"></span>Signatur</div>
      <div><span class="report-line"></span>Namnförtydligande</div>
      <div><span class="report-line"></span>Datum</div>
    </div>
  </section>

  <footer class="report-footer">
    Skapad ${escapeHtml(generatedAt.toLocaleString("sv-SE"))} med Linac checker · jojo23-coder.github.io/linac_checker
  </footer>
</article>`;
}

function metaRow(label, value) {
  return `<div><dt>${label}</dt><dd>${escapeHtml(value?.trim()) || "—"}</dd></div>`;
}

function tag(status, text = SECTION_STATUS_TEXT[status]) {
  return `<span class="tag tag--${status}">${escapeHtml(text)}</span>`;
}

function sectionTag(sectionSummary) {
  const { status, done, total } = sectionSummary;
  if (status === "open" || status === "todo") return tag(status, `${SECTION_STATUS_TEXT[status]} (${done}/${total})`);
  return tag(status);
}

function summaryRows({ group, sections }, session) {
  return `
    <tr class="report-group-row"><th colspan="3">${escapeHtml(`${group.number}. ${group.title}`)}</th></tr>
    ${sections
      .map(
        (sectionSummary) => `
    <tr>
      <td>${escapeHtml(`${sectionSummary.section.number} ${sectionSummary.section.title}`)}</td>
      <td>${sectionTag(sectionSummary)}</td>
      <td class="report-comment-cell">${escapeHtml(session.comments[sectionSummary.section.id] ?? "")}</td>
    </tr>`,
      )
      .join("")}`;
}

function countLine(summary) {
  const failed = summary.failed.length;
  return `${summary.done} av ${summary.total} kontroller ifyllda · ${failed} ${failed === 1 ? "underkänd" : "underkända"}`;
}

function actionsTable(actions) {
  const rows = actions.filter((action) => [action.text, action.workOrder, action.due].some((value) => value?.trim()));
  if (rows.length === 0) return `<p class="report-text">Inga.</p>`;
  return `
    <table class="report-table">
      <thead><tr><th>Åtgärd</th><th>Arbetsordernr.</th><th>Utförs senast</th></tr></thead>
      <tbody>
        ${rows
          .map(
            (action) => `
        <tr>
          <td>${escapeHtml(action.text)}</td>
          <td>${escapeHtml(action.workOrder)}</td>
          <td>${escapeHtml(action.due)}</td>
        </tr>`,
          )
          .join("")}
      </tbody>
    </table>`;
}

function groupDetails({ group, sections }, session) {
  return `
    <h3 class="report-group">${escapeHtml(`${group.number}. ${group.title}`)}</h3>
    ${sections.map((sectionSummary) => sectionDetails(sectionSummary, session)).join("")}`;
}

function sectionDetails(sectionSummary, session) {
  const { section, status, results } = sectionSummary;
  const comment = session.comments[section.id]?.trim();
  const byId = new Map(results.map((result) => [result.item.id, result]));
  const body =
    status === "skipped"
      ? `<p class="report-text">Ej utförd.${section.optional ? ` ${escapeHtml(section.optional)}` : ""}</p>`
      : `
      <table class="report-table report-results">
        <thead>
          <tr><th>Kontroll</th><th>Mätvärde</th><th>Referens</th><th>Tolerans</th><th>Avvikelse</th><th>Resultat</th></tr>
        </thead>
        <tbody>
          ${section.blocks.map((block) => blockRows(block, byId, session.values)).join("")}
        </tbody>
      </table>`;
  return `
    <div class="report-block">
      <h4><span>${escapeHtml(`${section.number} ${section.title}`)}</span>${sectionTag(sectionSummary)}</h4>
      ${body}
      ${comment ? `<p class="report-text"><strong>Kommentar:</strong> ${escapeHtml(comment)}</p>` : ""}
    </div>`;
}

function blockRows(block, byId, values) {
  const title = [block.title, block.detector && `detektor ${block.detector}`].filter(Boolean).join(", ");
  const head = title ? `<tr class="report-subhead"><td colspan="6">${escapeHtml(title)}</td></tr>` : "";
  return head + block.items.map((item) => itemRow(item, byId.get(item.id), values)).join("");
}

function itemRow(item, result, values) {
  const { ref, tol } = describeRule(item.rule, item.unit);
  const shown = describeValue(item, result, values);
  // A derived value (wedge factor, dose ratio) also shows the readings it came from.
  const inputs =
    item.derive && item.fields.length > 0
      ? item.fields
          .map((field) => values[field.key] && `${field.label ? `${field.label}: ` : ""}${formatTyped(values[field.key])}`)
          .filter(Boolean)
          .join(" · ")
      : "";
  let verdict = "";
  if (result.status === "ok" || result.status === "fail") verdict = tag(result.status === "ok" ? "ok" : "fail", CHECK_STATUS_TEXT[result.status]);
  else if (result.status === "invalid") verdict = tag("fail", CHECK_STATUS_TEXT.invalid);
  else if (item.rule && !item.optional) verdict = tag("open", "Saknas");

  return `
          <tr class="report-row report-row--${result.status}">
            <td>${escapeHtml(item.label)}${item.valueLabel && item.derive ? `<small>${escapeHtml(item.valueLabel)}</small>` : ""}</td>
            <td class="num">${escapeHtml(shown) || "—"}${inputs ? `<small>${escapeHtml(inputs)}</small>` : ""}</td>
            <td class="num">${escapeHtml(ref)}</td>
            <td class="num">${escapeHtml(tol)}</td>
            <td class="num">${escapeHtml(describeDeviation(item.rule, result.deviation, item.unit))}</td>
            <td>${verdict}</td>
          </tr>`;
}

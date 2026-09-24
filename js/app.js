// The form: renders the views and wires every event. The only file besides the page itself that
// touches the DOM; the logic it shows lives in checks.js (CLAUDE.md › Architecture).

import { LINACS, findLinac } from "./linacs/index.js";
import { DESCRIPTION, EQUIPMENT, INSTRUCTION, RESULT_NOTE, buildProtocol } from "./protocol.js";
import { summarizeSession } from "./checks.js";
import {
  CHECK_STATUS_TEXT,
  SECTION_STATUS_TEXT,
  describeDeviation,
  describeRule,
  escapeHtml,
  formatNumber,
  localDate,
  withUnit,
} from "./format.js";
import { createSession, exportSession, loadState, parseSessionFile, saveState, sessionFileName } from "./store.js";
import { buildReport, reportTitle } from "./report.js";

const storage = browserStorage();
const loaded = loadState(storage);
const app = { state: loaded.state, protocol: null, summary: null };

const el = {
  title: document.querySelector("#session-title"),
  overall: document.querySelector("#overall"),
  tabs: document.querySelector("#tabs"),
  notice: document.querySelector("#notice"),
  view: document.querySelector("#view"),
  reportView: document.querySelector("#report-view"),
  report: document.querySelector("#report"),
  importFile: document.querySelector("#import-file"),
};

// ---------------------------------------------------------------- state

function browserStorage() {
  try {
    const probe = window.localStorage;
    probe.getItem("probe");
    return probe;
  } catch {
    const memory = new Map();
    return { getItem: (key) => memory.get(key) ?? null, setItem: (key, value) => memory.set(key, String(value)) };
  }
}

function current() {
  return app.state.sessions[app.state.activeId];
}

function activate(sessionId) {
  app.state.activeId = sessionId;
  const linac = findLinac(current().linacId) ?? LINACS[0];
  app.protocol = buildProtocol(linac);
}

function startNewSession(linacId = LINACS[0].id) {
  const session = createSession({ linacId, date: localDate() });
  app.state.sessions[session.id] = session;
  activate(session.id);
  return session;
}

/** Saves after a change to the session's data. `touch: false` for UI-only changes (the open tab). */
function persist({ touch = true } = {}) {
  if (touch) current().updatedAt = new Date().toISOString();
  if (!saveState(storage, app.state)) {
    showNotice("Kunde inte spara på enheten. Exportera kontrollen till en fil för att inte förlora värdena.", "warn");
  }
}

function sessionName(session) {
  const linac = findLinac(session.linacId);
  return `${linac?.name ?? session.linacId} · ${session.date || "utan datum"}`;
}

// ---------------------------------------------------------------- rendering

function render() {
  app.summary = summarizeSession(app.protocol, current());
  renderChrome();
  renderView();
}

function renderChrome() {
  const session = current();
  el.title.textContent = sessionName(session);
  el.overall.dataset.status = app.summary.status;
  el.overall.textContent = SECTION_STATUS_TEXT[app.summary.status];

  const groups = app.summary.groups.map(({ group, sections, status }) => {
    const active = sections.filter((summary) => summary.status !== "skipped");
    const done = active.reduce((sum, summary) => sum + summary.done, 0);
    const total = active.reduce((sum, summary) => sum + summary.total, 0);
    return { id: group.id, label: `${group.number}. ${group.short}`, status, count: `${done}/${total}` };
  });
  const tabs = [
    { id: "start", label: "Start", status: null },
    ...groups,
    { id: "summary", label: "Summering", status: app.summary.status },
  ];
  el.tabs.innerHTML = tabs
    .map(
      (tab) => `
      <button type="button" class="tab" data-view="${attr(tab.id)}" ${tab.id === app.state.view ? 'aria-current="page"' : ""}>
        ${tab.status ? `<span class="dot" data-status="${tab.status}"></span>` : ""}
        <span>${escapeHtml(tab.label)}</span>
        ${tab.count ? `<small>${tab.count}</small>` : ""}
      </button>`,
    )
    .join("");
}

function renderView() {
  const view = app.state.view;
  const groupSummary = app.summary.groups.find(({ group }) => group.id === view);
  if (view === "summary") el.view.innerHTML = summaryView();
  else if (groupSummary) el.view.innerHTML = groupView(groupSummary);
  else el.view.innerHTML = startView();
}

/** After a value changes: recompute verdicts and patch them into the page without re-rendering the inputs. */
function refresh() {
  app.summary = summarizeSession(app.protocol, current());
  renderChrome();
  const groupSummary = app.summary.groups.find(({ group }) => group.id === app.state.view);
  if (!groupSummary) return;
  for (const sectionSummary of groupSummary.sections) {
    const sectionEl = el.view.querySelector(`[data-section="${CSS.escape(sectionSummary.section.id)}"]`);
    if (!sectionEl) continue;
    const pill = sectionEl.querySelector("[data-section-status]");
    pill.dataset.status = sectionSummary.status;
    pill.textContent = sectionStatusText(sectionSummary);
    for (const result of sectionSummary.results) {
      const checkEl = sectionEl.querySelector(`[data-check="${CSS.escape(result.item.id)}"]`);
      if (!checkEl) continue;
      checkEl.dataset.status = result.status;
      checkEl.querySelector("[data-verdict]").textContent = CHECK_STATUS_TEXT[result.status];
      checkEl.querySelector("[data-meta]").innerHTML = metaHtml(result.item, result);
      const computed = checkEl.querySelector("[data-computed]");
      if (computed) computed.textContent = computedText(result.item, result);
    }
  }
}

function showView(view, { scrollTo } = {}) {
  app.state.view = view;
  persist({ touch: false });
  render();
  const target = scrollTo && document.getElementById(scrollTo);
  if (target) target.scrollIntoView({ block: "start" });
  else window.scrollTo(0, 0);
  el.tabs.querySelector('[aria-current="page"]')?.scrollIntoView({ inline: "center", block: "nearest" });
}

let noticeTimer;
function showNotice(text, tone = "info") {
  el.notice.textContent = text;
  el.notice.dataset.tone = tone;
  el.notice.hidden = false;
  clearTimeout(noticeTimer);
  if (tone === "info") noticeTimer = setTimeout(() => (el.notice.hidden = true), 5000);
}

// ---------------------------------------------------------------- views: start

function startView() {
  const session = current();
  const hasValues = Object.values(session.values).some((value) => String(value ?? "").trim() !== "");
  const ticked = EQUIPMENT.filter((item) => session.equipment[item.id]).length;
  return `
    <section class="panel">
      <div class="section-heading"><h2>Kontroll</h2></div>
      <div class="stack">
        <label>
          Linac
          <select data-meta="linacId" ${hasValues ? "disabled" : ""}>
            ${LINACS.map((linac) => `<option value="${attr(linac.id)}" ${linac.id === session.linacId ? "selected" : ""}>${escapeHtml(`${linac.name} (${linac.model})`)}</option>`).join("")}
          </select>
          ${hasValues ? `<span class="helper">Starta en ny kontroll för att byta linac.</span>` : ""}
        </label>
        <div class="dual-grid">
          <label>Datum<input type="date" data-meta="date" value="${attr(session.date)}"></label>
          <label>Tel.nr<input type="tel" data-meta="phone" value="${attr(session.phone)}" autocomplete="tel"></label>
        </div>
        <label>Kontrollen utförd av<input type="text" data-meta="performer" value="${attr(session.performer)}" autocomplete="name"></label>
      </div>
    </section>

    <section class="panel">
      <div class="section-heading"><h2>Instruktion</h2></div>
      <div class="stack">
        ${detailCard("Om", "Beskrivning och genomförande", `
          ${paragraphs(DESCRIPTION)}
          <p class="helper">${escapeHtml(`${INSTRUCTION.title}, dokumentnr ${INSTRUCTION.number}, utgåva ${INSTRUCTION.edition}, giltig ${INSTRUCTION.validFrom} – ${INSTRUCTION.validTo}.`)}</p>`)}
        ${detailCard("1.", `Utrustning <small data-equipment-count>${ticked}/${EQUIPMENT.length}</small>`, `
          <div class="checklist">
            ${EQUIPMENT.map((item) => `
              <label class="tick">
                <input type="checkbox" data-equipment="${attr(item.id)}" ${session.equipment[item.id] ? "checked" : ""}>
                <span class="instruction-text">${escapeHtml(item.text)}</span>
              </label>`).join("")}
          </div>`)}
      </div>
    </section>

    <section class="panel">
      <div class="section-heading"><h2>Sparade kontroller</h2></div>
      <div class="session-list" data-session-list>${sessionList()}</div>
      <div class="button-row">
        <button type="button" class="button" data-action="new-session">Ny kontroll</button>
        <button type="button" class="button" data-action="import">Importera fil</button>
      </div>
      <p class="helper">Värdena sparas på den här enheten medan du skriver. Exportera kontrollen till en fil för att flytta den till en annan enhet eller spara en kopia.</p>
    </section>

    <button type="button" class="button button-primary button-next" data-view="${attr(app.protocol.groups[0].id)}">
      Börja: ${escapeHtml(`${app.protocol.groups[0].number}. ${app.protocol.groups[0].title}`)} ›
    </button>`;
}

function sessionList() {
  const sessions = Object.values(app.state.sessions).sort((a, b) => (b.date || "").localeCompare(a.date || "") || b.updatedAt.localeCompare(a.updatedAt));
  return sessions
    .map((session) => {
      const isActive = session.id === app.state.activeId;
      const protocol = isActive ? app.protocol : findLinac(session.linacId) && buildProtocol(findLinac(session.linacId));
      const status = protocol ? summarizeSession(protocol, session).status : "todo";
      return `
      <div class="session-row${isActive ? " is-active" : ""}">
        <div>
          <strong>${escapeHtml(sessionName(session))}</strong>
          <span class="helper">${escapeHtml(session.performer || "")}</span>
        </div>
        <span class="status-pill" data-status="${status}">${SECTION_STATUS_TEXT[status]}</span>
        <div class="session-actions">
          ${isActive ? `<span class="helper">Öppen</span>` : `<button type="button" class="button button-small" data-action="open-session" data-id="${attr(session.id)}">Öppna</button>`}
          <button type="button" class="button button-small" data-action="export" data-id="${attr(session.id)}">Exportera</button>
          <button type="button" class="button button-small button-danger" data-action="delete-session" data-id="${attr(session.id)}" aria-label="Ta bort ${attr(sessionName(session))}">Ta bort</button>
        </div>
      </div>`;
    })
    .join("");
}

// ---------------------------------------------------------------- views: a group of sections

function groupView({ group, sections }) {
  const groups = app.protocol.groups;
  const next = groups[groups.indexOf(group) + 1];
  return `
    <div class="view-heading"><h1>${escapeHtml(`${group.number}. ${group.title}`)}</h1></div>
    ${group.intro ? `<div class="group-intro">${detailCard("Instruktion", escapeHtml(`${group.number}. ${group.title}`), paragraphs(group.intro))}</div>` : ""}
    ${sections.map((sectionSummary) => sectionView(sectionSummary)).join("")}
    <button type="button" class="button button-primary button-next" data-view="${next ? attr(next.id) : "summary"}">
      ${next ? escapeHtml(`Nästa: ${next.number}. ${next.title}`) : "Till summeringen"} ›
    </button>`;
}

function sectionView(sectionSummary) {
  const { section } = sectionSummary;
  const session = current();
  const skipped = Boolean(session.skipped[section.id]);
  const results = new Map(sectionSummary.results.map((result) => [result.item.id, result]));
  return `
    <section class="panel section${skipped ? " is-skipped" : ""}" id="section-${domId(section.id)}" data-section="${attr(section.id)}">
      <div class="section-heading">
        <h2><span class="section-number">${escapeHtml(section.number)}</span> ${escapeHtml(section.title)}</h2>
        <span class="status-pill" data-section-status data-status="${sectionSummary.status}">${sectionStatusText(sectionSummary)}</span>
      </div>
      ${section.subtitle ? `<p class="helper section-subtitle">${escapeHtml(section.subtitle)}</p>` : ""}
      ${detailCard("Instruktion", "Visa instruktion", instructionHtml(section))}
      ${section.optional ? `
        <label class="switch">
          <input type="checkbox" data-skip="${attr(section.id)}" ${skipped ? "checked" : ""}>
          <span><strong>Utförs ej</strong> <span class="helper">${escapeHtml(section.optional)}</span></span>
        </label>` : ""}
      <div class="section-body">
        ${section.link ? `<a class="button button-link" href="${attr(section.link.href)}" target="_blank" rel="noopener">${escapeHtml(section.link.text)} ↗</a>` : ""}
        ${section.blocks.map((block) => blockView(block, results)).join("")}
      </div>
      <label class="comment">Kommentar
        <textarea rows="2" data-comment="${attr(section.id)}">${escapeHtml(session.comments[section.id] ?? "")}</textarea>
      </label>
    </section>`;
}

function blockView(block, results) {
  const stepId = `step-block-${domId(block.items[0].id)}`;
  const hasHead = block.title || block.detector || block.step;
  return `
    <div class="block">
      ${hasHead ? `
        <div class="block-head">
          <div>
            ${block.title ? `<h3>${escapeHtml(block.title)}</h3>` : ""}
            ${block.detector || block.note ? `<span class="helper">${escapeHtml([block.detector && `Detektor: ${block.detector}`, block.note].filter(Boolean).join(" · "))}</span>` : ""}
          </div>
          ${block.step ? infoButton(stepId) : ""}
        </div>
        ${block.step ? `<div class="step" id="${stepId}" hidden>${stepHtml(block.step, block.footnote)}</div>` : ""}` : ""}
      ${block.heading ? `<p class="block-heading">${escapeHtml(block.heading)}</p>` : ""}
      ${block.items.map((item) => checkView(item, results.get(item.id))).join("")}
    </div>`;
}

function checkView(item, result) {
  const values = current().values;
  const stepId = `step-${domId(item.id)}`;
  const fields = item.fields.length
    ? item.fields.map((field) => fieldView(item, field, values)).join("")
    : `<span class="computed" data-computed>${escapeHtml(computedText(item, result))}</span>`;
  return `
    <div class="check${item.rule?.type === "ok" ? " is-choice" : ""}" data-check="${attr(item.id)}" data-status="${result.status}">
      <div class="check-head">
        <span class="check-label">${escapeHtml(item.label)}${item.optional ? ` <span class="helper">(valfri)</span>` : ""}</span>
        ${item.step ? infoButton(stepId) : ""}
      </div>
      ${item.step ? `<div class="step" id="${stepId}" hidden>${stepHtml(item.step)}</div>` : ""}
      <div class="check-row${item.fields.length > 1 ? " is-pair" : ""}">
        <div class="check-fields">${fields}</div>
        <span class="verdict" data-verdict>${CHECK_STATUS_TEXT[result.status]}</span>
      </div>
      <p class="check-meta" data-meta>${metaHtml(item, result)}</p>
    </div>`;
}

function fieldView(item, field, values) {
  const value = values[field.key] ?? "";
  if (field.kind === "choice") {
    return `
      <div class="choice" role="group" aria-label="${attr(item.label)}">
        ${field.options.map((option) => `<button type="button" class="choice-button" data-choice="${attr(field.key)}" data-value="${attr(option)}" aria-pressed="${value === option}">${escapeHtml(option)}</button>`).join("")}
      </div>`;
  }
  const id = `field-${domId(field.key)}`;
  const label = field.label ? `${item.label}, ${field.label}` : item.label;
  return `
    <div class="field">
      ${field.label ? `<label class="field-label" for="${id}">${escapeHtml(field.label)}</label>` : ""}
      <div class="input-wrap">
        <input id="${id}" type="text" ${field.kind === "number" ? 'inputmode="decimal"' : ""} autocomplete="off" autocorrect="off" spellcheck="false" enterkeyhint="next"
          data-field="${attr(field.key)}" value="${attr(value)}" aria-label="${attr(label)}">
        ${field.kind === "number" && item.unit ? `<span class="unit">${escapeHtml(item.unit)}</span>` : ""}
        ${field.signed ? `<button type="button" class="sign-button" data-sign="${attr(field.key)}" aria-label="Byt tecken på ${attr(label)}">±</button>` : ""}
      </div>
    </div>`;
}

/** The line under a check: derived value, reference, tolerance, deviation. */
function metaHtml(item, result) {
  const parts = [];
  if (item.derive && item.fields.length > 0) {
    const waiting = result.touched && result.value === null && item.waitingFor ? `väntar på ${item.waitingFor}` : "—";
    parts.push(`${escapeHtml(item.valueLabel)} <b>${result.value === null ? waiting : formatNumber(result.value, item.digits)}</b>`);
  } else if (item.derive) {
    parts.push(escapeHtml(item.valueLabel));
  }
  const { ref, tol } = describeRule(item.rule, item.unit);
  if (ref) parts.push(`Ref ${escapeHtml(ref)}`);
  if (tol && item.rule.type !== "ok") parts.push(`Tol ${escapeHtml(tol)}`);
  const deviation = describeDeviation(item.rule, result.deviation, item.unit);
  if (deviation) parts.push(`Avv. <b>${escapeHtml(deviation)}</b>`);
  if (result.status === "invalid") parts.push("<b>Inte ett tal</b>");
  return parts.join(" · ");
}

function computedText(item, result) {
  if (result.value === null) return result.touched || !item.waitingFor ? "—" : `väntar på ${item.waitingFor}`;
  return withUnit(formatNumber(result.value, item.digits ?? 2), item.unit);
}

function sectionStatusText({ status, done, total }) {
  if (status === "open" || status === "todo") return `${done}/${total}`;
  return SECTION_STATUS_TEXT[status];
}

function instructionHtml(section) {
  const steps = section.blocks.flatMap((block) => [block.step, ...block.items.map((item) => item.step)]).filter(Boolean);
  const footnotes = section.blocks.map((block) => block.footnote).filter(Boolean);
  const list = section.stepList === "bullets" ? "ul" : "ol";
  return `
    ${paragraphs(section.intro ?? [])}
    ${steps.length ? `<${list} class="steps">${steps.map((step) => `<li class="instruction-text">${escapeHtml(step)}</li>`).join("")}</${list}>` : ""}
    ${footnotes.map((note) => `<p class="footnote instruction-text">${escapeHtml(note)}</p>`).join("")}
    ${section.link ? `<p><a href="${attr(section.link.href)}" target="_blank" rel="noopener">${escapeHtml(section.link.text)} ↗</a></p>` : ""}`;
}

function stepHtml(step, footnote) {
  return `<p class="instruction-text">${escapeHtml(step)}</p>${footnote ? `<p class="footnote instruction-text">${escapeHtml(footnote)}</p>` : ""}`;
}

// ---------------------------------------------------------------- views: summary

function summaryView() {
  const session = current();
  const { summary } = app;
  return `
    <div class="view-heading"><h1>Summering</h1></div>
    <section class="panel">
      <div class="results results-primary">
        <article class="metric metric-primary" data-status="${summary.status}">
          <span>Totalt</span>
          <strong>${SECTION_STATUS_TEXT[summary.status]}</strong>
        </article>
        <article class="metric metric-primary">
          <span>Ifyllda kontroller</span>
          <strong>${summary.done} / ${summary.total}</strong>
        </article>
      </div>
      ${summary.failed.length ? `
        <div class="failures">
          <h3>Underkända kontroller</h3>
          <ul>
            ${summary.failed.map(({ item, section, value, deviation }) => `
              <li>
                <button type="button" class="link-button" data-goto="${attr(section.id)}">${escapeHtml(`${section.number} ${item.label}`)}</button>
                <span class="helper">${escapeHtml(failureDetail(item, value, deviation))}</span>
              </li>`).join("")}
          </ul>
        </div>` : ""}
      <div class="summary-list">
        ${summary.groups.map(({ group, sections }) => `
          <h3>${escapeHtml(`${group.number}. ${group.title}`)}</h3>
          ${sections.map((sectionSummary) => `
            <button type="button" class="summary-row" data-goto="${attr(sectionSummary.section.id)}">
              <span>${escapeHtml(`${sectionSummary.section.number} ${sectionSummary.section.title}`)}</span>
              <span class="status-pill" data-status="${sectionSummary.status}">${sectionStatusText(sectionSummary)}</span>
            </button>`).join("")}`).join("")}
      </div>
    </section>

    <section class="panel">
      <div class="section-heading"><h2>Kommentarer</h2></div>
      <textarea rows="4" data-meta="notes" aria-label="Kommentarer">${escapeHtml(session.notes)}</textarea>
    </section>

    <section class="panel">
      <div class="section-heading"><h2>Åtgärder att utföra efter besiktning</h2></div>
      <div class="actions-list">
        ${session.actions.map((action, index) => `
          <div class="action-row">
            <label>Åtgärd<textarea rows="2" data-action-field="text" data-index="${index}">${escapeHtml(action.text)}</textarea></label>
            <div class="dual-grid">
              <label>Arbetsordernr.<input type="text" data-action-field="workOrder" data-index="${index}" value="${attr(action.workOrder)}"></label>
              <label>Utförs senast<input type="date" data-action-field="due" data-index="${index}" value="${attr(action.due)}"></label>
            </div>
            <button type="button" class="button button-small button-danger" data-action="remove-action" data-index="${index}">Ta bort åtgärd</button>
          </div>`).join("")}
      </div>
      <button type="button" class="button" data-action="add-action">Lägg till åtgärd</button>
    </section>

    <section class="panel">
      <div class="section-heading"><h2>4. Resultat</h2></div>
      <p class="helper instruction-text">${escapeHtml(RESULT_NOTE)}</p>
      <div class="button-row">
        <button type="button" class="button button-primary" data-action="report">Skapa PDF-rapport</button>
        <button type="button" class="button" data-action="export" data-id="${attr(session.id)}">Exportera kontrollen</button>
      </div>
    </section>`;
}

function failureDetail(item, value, deviation) {
  if (item.rule.type === "ok") return String(value);
  const { tol } = describeRule(item.rule, item.unit);
  const shown = item.derive ? formatNumber(value, item.digits) : withUnit(formatNumber(value), item.unit);
  const dev = describeDeviation(item.rule, deviation, item.unit);
  return `${shown}${dev ? ` (avv. ${dev})` : ""}, tolerans ${tol}`;
}

// ---------------------------------------------------------------- small HTML helpers

function detailCard(tag, title, body) {
  return `
    <details class="detail-card">
      <summary><span>${escapeHtml(tag)}</span>${title}</summary>
      <div class="panel-block">${body}</div>
    </details>`;
}

function infoButton(targetId) {
  return `<button type="button" class="info-button" data-toggle="${targetId}" aria-controls="${targetId}" aria-expanded="false" aria-label="Visa instruktion">i</button>`;
}

function paragraphs(texts) {
  return texts.map((text) => `<p class="instruction-text">${escapeHtml(text)}</p>`).join("");
}

function attr(value) {
  return escapeHtml(value ?? "");
}

/** A string safe to use in an element id: item ids contain dots. */
function domId(value) {
  return String(value).replace(/[^a-zA-Z0-9_-]/g, "_");
}

// ---------------------------------------------------------------- events

document.addEventListener("input", (event) => {
  const target = event.target;
  const session = current();
  if (target.dataset.field) {
    session.values[target.dataset.field] = target.value;
    persist();
    refresh();
  } else if (target.dataset.comment) {
    session.comments[target.dataset.comment] = target.value;
    persist();
  } else if (target.dataset.meta && target.type !== "select-one") {
    session[target.dataset.meta] = target.value;
    persist();
    if (target.dataset.meta === "date") renderChrome();
  } else if (target.dataset.actionField) {
    session.actions[Number(target.dataset.index)][target.dataset.actionField] = target.value;
    persist();
  }
});

document.addEventListener("change", (event) => {
  const target = event.target;
  const session = current();
  if (target.dataset.skip) {
    session.skipped[target.dataset.skip] = target.checked;
    target.closest(".section").classList.toggle("is-skipped", target.checked);
    persist();
    refresh();
  } else if (target.dataset.equipment) {
    session.equipment[target.dataset.equipment] = target.checked;
    persist();
    const count = el.view.querySelector("[data-equipment-count]");
    if (count) count.textContent = `${EQUIPMENT.filter((item) => session.equipment[item.id]).length}/${EQUIPMENT.length}`;
  } else if (target.dataset.meta === "linacId") {
    session.linacId = target.value;
    activate(session.id);
    persist();
    render();
  } else if (target.dataset.meta === "date" || target.dataset.meta === "performer") {
    const list = el.view.querySelector("[data-session-list]");
    if (list) list.innerHTML = sessionList();
  } else if (target === el.importFile && target.files[0]) {
    importFile(target.files[0]);
    target.value = "";
  }
});

// Keep the keyboard open when the ± key is tapped: stop the input from losing focus.
document.addEventListener("pointerdown", (event) => {
  if (event.target.closest("[data-sign]")) event.preventDefault();
});

document.addEventListener("keydown", (event) => {
  if (event.key !== "Enter" || !event.target.matches("input[data-field]")) return;
  event.preventDefault();
  const inputs = [...el.view.querySelectorAll("input[data-field]")];
  inputs[inputs.indexOf(event.target) + 1]?.focus();
});

document.addEventListener("click", (event) => {
  const target = event.target.closest("button, [data-view]");
  if (!target) return;
  const session = current();

  if (target.dataset.view) {
    showView(target.dataset.view);
  } else if (target.dataset.goto) {
    const group = app.protocol.groups.find((candidate) => candidate.sections.some((section) => section.id === target.dataset.goto));
    showView(group.id, { scrollTo: `section-${domId(target.dataset.goto)}` });
  } else if (target.dataset.toggle) {
    const step = document.getElementById(target.dataset.toggle);
    step.hidden = !step.hidden;
    target.setAttribute("aria-expanded", String(!step.hidden));
  } else if (target.dataset.choice) {
    const key = target.dataset.choice;
    session.values[key] = session.values[key] === target.dataset.value ? "" : target.dataset.value;
    for (const button of target.parentElement.querySelectorAll("[data-choice]")) {
      button.setAttribute("aria-pressed", String(session.values[key] === button.dataset.value));
    }
    persist();
    refresh();
  } else if (target.dataset.sign) {
    const input = el.view.querySelector(`input[data-field="${CSS.escape(target.dataset.sign)}"]`);
    const text = input.value.trim();
    input.value = /^[-−]/.test(text) ? text.replace(/^[-−]/, "") : `-${text}`;
    input.focus();
    input.dispatchEvent(new Event("input", { bubbles: true }));
  } else if (target.dataset.action) {
    runAction(target.dataset.action, target);
  }
});

function runAction(action, target) {
  const session = current();
  switch (action) {
    case "new-session": {
      const created = startNewSession(session.linacId);
      persist();
      showView("start");
      showNotice(`Ny kontroll: ${sessionName(created)}.`);
      break;
    }
    case "open-session":
      activate(target.dataset.id);
      persist({ touch: false });
      showView("start");
      break;
    case "delete-session": {
      const doomed = app.state.sessions[target.dataset.id];
      if (!window.confirm(`Ta bort kontrollen ${sessionName(doomed)}? Alla värden raderas från enheten och det går inte att ångra.`)) return;
      delete app.state.sessions[doomed.id];
      if (doomed.id === app.state.activeId) {
        const remaining = Object.values(app.state.sessions).sort((a, b) => b.updatedAt.localeCompare(a.updatedAt));
        if (remaining.length) activate(remaining[0].id);
        else startNewSession(doomed.linacId);
      }
      persist({ touch: false });
      render();
      break;
    }
    case "export":
      exportFile(app.state.sessions[target.dataset.id]);
      break;
    case "import":
      el.importFile.click();
      break;
    case "add-action":
      session.actions.push({ text: "", workOrder: "", due: "" });
      persist();
      renderView();
      el.view.querySelector(`[data-action-field="text"][data-index="${session.actions.length - 1}"]`)?.focus();
      break;
    case "remove-action":
      session.actions.splice(Number(target.dataset.index), 1);
      persist();
      renderView();
      break;
    case "report":
      openReport();
      break;
    case "print":
      printReport();
      break;
    case "close-report":
      el.reportView.hidden = true;
      document.body.classList.remove("report-open");
      break;
  }
}

// ---------------------------------------------------------------- files and report

async function exportFile(session) {
  const linac = findLinac(session.linacId);
  const name = sessionFileName(session, linac);
  const file = new File([exportSession(session)], name, { type: "application/json" });
  // On a phone the share sheet can AirDrop or mail the file straight to the office computer.
  if (navigator.canShare?.({ files: [file] }) && matchMedia("(pointer: coarse)").matches) {
    try {
      await navigator.share({ files: [file], title: sessionName(session) });
      return;
    } catch (error) {
      if (error.name === "AbortError") return;
    }
  }
  const url = URL.createObjectURL(file);
  const link = Object.assign(document.createElement("a"), { href: url, download: name });
  document.body.append(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

async function importFile(file) {
  let session;
  try {
    session = parseSessionFile(await file.text());
  } catch (error) {
    showNotice(error.message, "warn");
    return;
  }
  if (!findLinac(session.linacId)) {
    showNotice(`Filen gäller en linac som appen inte känner till (${session.linacId}).`, "warn");
    return;
  }
  const existing = app.state.sessions[session.id];
  if (existing && !window.confirm(`Kontrollen ${sessionName(existing)} finns redan på enheten. Ersätta den med filens version?`)) return;
  app.state.sessions[session.id] = session;
  activate(session.id);
  persist({ touch: false });
  showView("start");
  showNotice(`Importerade ${sessionName(session)}.`);
}

function openReport() {
  app.summary = summarizeSession(app.protocol, current());
  el.report.innerHTML = buildReport(app.protocol, current(), app.summary);
  el.reportView.hidden = false;
  document.body.classList.add("report-open");
  el.reportView.scrollTo(0, 0);
}

function printReport() {
  // The document title becomes the suggested PDF file name.
  const title = document.title;
  document.title = reportTitle(app.protocol.linac, current());
  window.addEventListener("afterprint", () => (document.title = title), { once: true });
  window.print();
}

// ---------------------------------------------------------------- start

if (!current()) startNewSession();
activate(app.state.activeId);
const views = ["start", "summary", ...app.protocol.groups.map((group) => group.id)];
if (!views.includes(app.state.view)) app.state.view = "start";
render();
if (loaded.warning) showNotice(loaded.warning, "warn");

if ("serviceWorker" in navigator) navigator.serviceWorker.register("sw.js").catch(() => {});
navigator.storage?.persist?.().catch(() => {});

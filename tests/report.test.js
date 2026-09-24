import { test } from "node:test";
import assert from "node:assert/strict";

import { summarizeSession } from "../js/checks.js";
import { findLinac } from "../js/linacs/index.js";
import { buildProtocol } from "../js/protocol.js";
import { buildReport, reportTitle } from "../js/report.js";
import { createSession } from "../js/store.js";

const linac = findLinac("linac4");
const protocol = buildProtocol(linac);

function report(session) {
  return buildReport(protocol, session, summarizeSession(protocol, session), new Date("2026-09-24T12:00:00"));
}

test("the report shows each result with its reference, tolerance, deviation and verdict", () => {
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  session.values["6x.dd.d2010"] = "0,566";
  const html = report(session);
  assert.match(html, /D20\/10<\/td>\s*<td class="num">0\.566<\/td>\s*<td class="num">0\.559<\/td>\s*<td class="num">±1 %<\/td>\s*<td class="num">\+1\.25 %<\/td>/);
  assert.match(html, /tag--fail">Underkänd/);
  assert.match(html, /dokumentnr 100549, utgåva 3\.0/);
});

test("text typed by the user cannot inject markup into the report", () => {
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  session.performer = "<img src=x onerror=alert(1)>";
  session.comments["2.1"] = "<b>bold</b>";
  const html = report(session);
  assert.ok(!html.includes("<img src=x"));
  assert.ok(html.includes("&lt;b&gt;bold&lt;/b&gt;"));
});

test("a skipped section reads Ej utförd instead of listing empty checks", () => {
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  session.skipped["6x.output"] = true;
  assert.match(report(session), /3\.2 Dosmonitor\/output<\/span><span class="tag tag--skipped">Ej utförd/);
});

test("the report title doubles as the PDF file name", () => {
  assert.equal(reportTitle(linac, { date: "2026-09-24" }), "Årskontroll Linac 4 2026-09-24");
});

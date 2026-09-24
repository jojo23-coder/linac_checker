import { test } from "node:test";
import assert from "node:assert/strict";

import {
  FORMAT_VERSION,
  STORAGE_KEY,
  createSession,
  emptyState,
  exportSession,
  loadState,
  parseSessionFile,
  saveState,
  sessionFileName,
} from "../js/store.js";

function fakeStorage(initial = {}) {
  const data = new Map(Object.entries(initial));
  return {
    data,
    getItem: (key) => (data.has(key) ? data.get(key) : null),
    setItem: (key, value) => data.set(key, String(value)),
  };
}

test("a saved state loads back unchanged", () => {
  const storage = fakeStorage();
  const state = emptyState();
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  session.values["2.1.pin"] = "0,3";
  state.sessions[session.id] = session;
  state.activeId = session.id;

  assert.equal(saveState(storage, state), true);
  const { state: loaded, warning } = loadState(storage);
  assert.equal(warning, null);
  assert.deepEqual(loaded, state);
});

test("an empty device starts with an empty state", () => {
  const { state, warning } = loadState(fakeStorage());
  assert.deepEqual(state, emptyState());
  assert.equal(warning, null);
});

test("unreadable saved data is set aside, never overwritten", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: "{not json" });
  const { state, warning } = loadState(storage);
  assert.deepEqual(state, emptyState());
  assert.match(warning, /kunde inte läsas/);
  const backups = [...storage.data.keys()].filter((key) => key.startsWith(`${STORAGE_KEY}.unreadable.`));
  assert.equal(backups.length, 1);
  assert.equal(storage.data.get(backups[0]), "{not json");
});

test("saved data in an unknown format version is set aside too", () => {
  const storage = fakeStorage({ [STORAGE_KEY]: JSON.stringify({ version: FORMAT_VERSION + 1, sessions: {} }) });
  const { warning } = loadState(storage);
  assert.ok(warning);
  assert.equal([...storage.data.keys()].length, 2);
});

test("a browser that refuses storage is reported, not thrown", () => {
  const refusing = {
    getItem: () => {
      throw new Error("SecurityError");
    },
    setItem: () => {
      throw new Error("QuotaExceededError");
    },
  };
  assert.match(loadState(refusing).warning, /sparas inte/);
  assert.equal(saveState(refusing, emptyState()), false);
});

test("export and import round-trip a session", () => {
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  session.performer = "A. Fysiker";
  session.values["6x.dd.dmax10"] = "1,546";
  session.actions.push({ text: "Justera laser", workOrder: "AO-123", due: "2026-10-01" });
  assert.deepEqual(parseSessionFile(exportSession(session)), session);
});

test("import explains what is wrong with a file", () => {
  assert.throws(() => parseSessionFile("hello"), /inte JSON/);
  assert.throws(() => parseSessionFile(JSON.stringify({ format: "other" })), /inte en exporterad årskontroll/);
  assert.throws(
    () => parseSessionFile(JSON.stringify({ format: "linac-checker-session", version: 99, session: {} })),
    /formatversion 99/,
  );
  assert.throws(
    () => parseSessionFile(JSON.stringify({ format: "linac-checker-session", version: FORMAT_VERSION, session: { id: "x" } })),
    /saknar kontrollens data/,
  );
});

test("the export file name says which linac and day", () => {
  const session = createSession({ linacId: "linac4", date: "2026-09-24" });
  assert.equal(sessionFileName(session, { name: "Linac 4" }), "arskontroll-linac4-2026-09-24.json");
});

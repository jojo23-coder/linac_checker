// Saved sessions: one per yearly check, kept in the browser's localStorage, plus JSON export and
// import to move a session between devices. Saved measurements are never silently dropped
// (CLAUDE.md › Architecture): a change to the stored shape needs a migration here.

export const STORAGE_KEY = "linac-checker";
export const FORMAT_VERSION = 1;
const FILE_FORMAT = "linac-checker-session";

export function emptyState() {
  return { version: FORMAT_VERSION, activeId: null, view: "start", sessions: {} };
}

/**
 * Reads the saved state. Returns { state, warning }. Data that cannot be read is copied to a
 * backup key before anything else can overwrite it, and the warning says where it went.
 */
export function loadState(storage) {
  let raw;
  try {
    raw = storage.getItem(STORAGE_KEY);
  } catch {
    return { state: emptyState(), warning: "Webbläsaren tillåter inte lagring: värdena sparas inte på den här enheten." };
  }
  if (!raw) return { state: emptyState(), warning: null };

  try {
    const parsed = JSON.parse(raw);
    if (parsed?.version !== FORMAT_VERSION || typeof parsed.sessions !== "object" || parsed.sessions === null) {
      throw new Error("Unknown stored format");
    }
    return { state: { ...emptyState(), ...parsed }, warning: null };
  } catch {
    const backupKey = `${STORAGE_KEY}.unreadable.${Date.now()}`;
    try {
      storage.setItem(backupKey, raw);
    } catch {
      // Nothing more we can do; the raw data stays under STORAGE_KEY until the next save.
    }
    return { state: emptyState(), warning: `Sparade data kunde inte läsas. De har lagts undan i webbläsarens lagring som "${backupKey}".` };
  }
}

/** Saves the state; returns false when the browser refuses (private mode, storage full). */
export function saveState(storage, state) {
  try {
    storage.setItem(STORAGE_KEY, JSON.stringify(state));
    return true;
  } catch {
    return false;
  }
}

export function createSession({ linacId, date, id = newId() }) {
  const now = new Date().toISOString();
  return {
    id,
    linacId,
    date,
    performer: "",
    phone: "",
    values: {},
    comments: {},
    skipped: {},
    equipment: {},
    notes: "",
    actions: [],
    createdAt: now,
    updatedAt: now,
  };
}

function newId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `${Date.now().toString(36)}-${Math.random().toString(36).slice(2, 10)}`;
}

/** The session as a JSON file to save or send to another device. */
export function exportSession(session) {
  return JSON.stringify({ format: FILE_FORMAT, version: FORMAT_VERSION, exportedAt: new Date().toISOString(), session }, null, 2);
}

/** Reads an exported file back. Throws an Error with a Swedish message the UI can show. */
export function parseSessionFile(text) {
  let parsed;
  try {
    parsed = JSON.parse(text);
  } catch {
    throw new Error("Filen är inte en exporterad årskontroll (inte JSON).");
  }
  if (parsed?.format !== FILE_FORMAT) throw new Error("Filen är inte en exporterad årskontroll.");
  if (parsed.version !== FORMAT_VERSION) throw new Error(`Filen har formatversion ${parsed.version}; appen läser version ${FORMAT_VERSION}.`);

  const session = parsed.session;
  if (!session || typeof session.id !== "string" || typeof session.linacId !== "string" || typeof session.values !== "object") {
    throw new Error("Filen saknar kontrollens data.");
  }
  // Fill in anything an older export of the same version left out, so the UI can rely on it.
  return { ...createSession({ linacId: session.linacId, date: session.date ?? "", id: session.id }), ...session };
}

export function sessionFileName(session, linac) {
  const name = (linac?.name ?? session.linacId).toLowerCase().replace(/[^a-z0-9]+/g, "");
  return `arskontroll-${name}-${session.date || "utan-datum"}.json`;
}

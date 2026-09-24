// Every linac the app knows. Adding one is a data file plus a line here (CLAUDE.md › Architecture).
import linac4 from "./linac4.js";

export const LINACS = [linac4];

export function findLinac(id) {
  return LINACS.find((linac) => linac.id === id) ?? null;
}

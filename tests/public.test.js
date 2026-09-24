// The repository and the GitHub Pages site are public, so internal information from the source
// documents is censored (CLAUDE.md › Source documents). This scans every text file in the repo.
import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { extname, join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const self = fileURLToPath(import.meta.url);
const TEXT = new Set([".js", ".mjs", ".html", ".css", ".md", ".json", ".webmanifest", ".yml", ".svg"]);

function textFiles(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const path = join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === ".git" || entry.name === "node_modules" ? [] : textFiles(path);
    return TEXT.has(extname(entry.name)) && path !== self ? [path] : [];
  });
}

const FORBIDDEN = [
  { what: "a path on a network drive (V:\\…)", pattern: /\b[A-Z]:\\/ },
  { what: "a cloud-folder path", pattern: /OneDrive|SharePoint/i },
  { what: "a patient number", pattern: /patient\s+\d/i },
  { what: "a personnummer", pattern: /\b(19|20)?\d{6}[-+]\d{4}\b/ },
];

test("no internal paths, patient numbers or personnummer in the public repo", () => {
  const found = [];
  for (const file of textFiles(root)) {
    readFileSync(file, "utf8")
      .split("\n")
      .forEach((line, index) => {
        for (const { what, pattern } of FORBIDDEN) {
          if (pattern.test(line)) found.push(`${relative(root, file)}:${index + 1} has ${what}`);
        }
      });
  }
  assert.deepEqual(found, []);
});

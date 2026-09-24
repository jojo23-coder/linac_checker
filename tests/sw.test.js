// The service worker must cache every file the page loads, or the app works in the office and
// fails in the bunker (CLAUDE.md › Architecture).
import { test } from "node:test";
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join, relative } from "node:path";
import { fileURLToPath } from "node:url";

const root = fileURLToPath(new URL("..", import.meta.url));
const read = (path) => readFileSync(join(root, path), "utf8");

const precache = JSON.parse(
  read("sw.js")
    .match(/const PRECACHE = (\[[\s\S]*?\]);/)[1]
    .replace(/,\s*\]/, "]"),
);

function filesUnder(dir) {
  return readdirSync(join(root, dir), { withFileTypes: true }).flatMap((entry) =>
    entry.isDirectory() ? filesUnder(join(dir, entry.name)) : [relative(root, join(root, dir, entry.name))],
  );
}

test("every script, icon and stylesheet is precached", () => {
  const expected = [...filesUnder("js"), ...filesUnder("icons"), "index.html", "styles.css", "manifest.webmanifest"];
  for (const file of expected) assert.ok(precache.includes(file), `${file} is missing from PRECACHE in sw.js`);
});

test("every local file index.html and the manifest reference is precached", () => {
  const html = read("index.html");
  const references = [...html.matchAll(/(?:href|src)="([^"]+)"/g)].map((match) => match[1]);
  const manifest = JSON.parse(read("manifest.webmanifest"));
  references.push(...manifest.icons.map((icon) => icon.src));
  for (const reference of references.filter((ref) => !/^https?:/.test(ref))) {
    assert.ok(precache.includes(reference), `${reference} is missing from PRECACHE in sw.js`);
  }
});

test("every precached file exists", () => {
  for (const file of precache.filter((entry) => entry !== "./")) {
    assert.ok(existsSync(join(root, file)), `${file} is in PRECACHE but does not exist`);
  }
});

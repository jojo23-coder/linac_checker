# CLAUDE.md

## Project

**linac_checker** is a phone-first web app for the yearly check (*årskontroll*) of the Varian
TrueBeam linacs at Strålningsfysik, Region Västerbotten. It replaces the Excel results workbook
in the bunker: the physicist types each measurement on their phone, sees at once whether it is
within tolerance, opens the instruction step for that check without leaving the form, and at the
end prints a PDF report.

It is a static site served by GitHub Pages from `main` (root folder) at
<https://jojo23-coder.github.io/linac_checker/>. No build step, no framework, no runtime
dependencies: plain HTML, CSS and ES modules. The look follows
[absolute_dose_calibration](https://github.com/jojo23-coder/absolute_dose_calibration).

**This file is a RULESET, not a log.** Add a rule when it will stop a future mistake; never add
history. One home per rule.

## Source documents: the app copies them, it does not author them

Two controlled documents define everything the app checks. Neither is committed (`.gitignore`
excludes `*.pdf` and `*.xlsx`): ask the user for them when an issue needs them.

| Document | What the app takes from it |
| --- | --- |
| Instruktion *Årskontroll Varian TrueBeam*, dokumentnr 100549 | The order of the checks, the instruction text shown with each check, the general tolerances (section 2) |
| *Årskontroll ÅÅÅÅ LinacX (Varian TrueBeam) Resultat.xlsx*, one per linac | Reference values and tolerances per beam (sheet *Referensvärden*) and the pass/fail formulas |

- **Instruction text is verbatim.** Repair extraction damage (a lost `±`, `°`, `×`, `µ`), never
  reword. A new utgåva of the instruction replaces the text *and* the version the report cites
  (`INSTRUCTION` in `js/protocol.js`) in the same PR.
- **The repo and the site are public: censor what is internal.** File paths on network drives or
  in cloud folders become `[intern sökväg]`, system ids such as test patients become
  `[internt id]`; names of people and personal identity numbers never go in at all.
  `tests/public.test.js` reds on a drive path, a cloud-folder path, a patient number or a
  personnummer anywhere in the repo.
- **Every reference value and tolerance cites its cell.** A PR that adds or changes one names the
  sheet and cell (`Referensvärden!J9`) so the reviewer can check it against the workbook. Never
  guess a number: ask for the workbook.
- **Pass/fail follows the workbook's formulas**, including where they are stricter or looser than
  the instruction's wording (flatness is ±2 percentage points, not ±2 % of the reference). Where a
  formula is a copy-paste slip, follow the instruction and say so in the PR.

## Commands

```bash
node --test                    # every tests/*.test.js — the exit code is the verdict
python3 -m http.server 8000    # serve locally at http://localhost:8000 (see Processes you start)
```

The service worker caches every file, so a local reload can show the *previous* version once.
Hard-reload, or tick *Update on reload* in DevTools › Application.

## Architecture

| File | Role | DOM? |
| --- | --- | --- |
| `js/checks.js` | Pure logic: read a typed number, judge it against a rule, roll results up into section and overall verdicts | No |
| `js/format.js` | How numbers, rules, deviations and verdicts read, on screen and in the report | No |
| `js/protocol.js` | Builds the sections and checks for one linac: instruction text, general tolerances, the per-beam sections | No |
| `js/linacs/*.js` | One file per linac, **numbers only** (beams, reference values, MU for the output check). Registered in `js/linacs/index.js` | No |
| `js/store.js` | Saved sessions in `localStorage`; JSON export and import | No |
| `js/report.js` | Builds the printable report as an HTML string | No |
| `js/app.js` | Renders the form, wires events, puts the report on the page and prints it | Yes |
| `sw.js` | Service worker: the app must work with no signal in the bunker | — |

- **Only `app.js` touches the DOM.** Everything else is imported by the Node tests.
- **Adding a linac is a data file plus one line in `js/linacs/index.js`.** If a linac needs
  something the data cannot express, extend `protocol.js`; never put logic in a data file.
- **Every file the page loads is in `PRECACHE` in `sw.js`.** A file missing from it works in the
  office and fails in the bunker; `tests/sw.test.js` reds on it. Bump `CACHE` when the list changes.
- **Saved measurements are never silently dropped.** A check's id (`6x.dd.dmax`) is its storage
  key, so renaming one orphans a year's values on someone's phone. A change to ids or to the
  stored shape ships with a migration in `store.js` and a test that loads the old shape. This is
  the one exception to the no-back-compat rule below.

## UI conventions

- **UI text is Swedish**, matching the instruction and the workbook. Code, comments, commits,
  issues and PRs are English.
- **Phone first, used one-handed in a dim bunker.** Touch targets at least 44 px; numeric fields
  are `type="text" inputmode="decimal"` and accept a decimal comma (`0,5`); a check's verdict is
  visible next to its input.
- **Colours are custom properties** in `styles.css` `:root`; never hard-code a colour elsewhere.
  The printed report has its own light palette under `.report`.
- **The PDF is the browser's print** (`window.print()`, then *Spara som PDF*). Its layout lives in
  `@media print`; check a report change by printing to PDF and looking at every page.

## Processes you start

Every process you start is **bounded in time and verifiably dead when you are done**: the local
server, a headless browser, anything backgrounded. Capture the PID at spawn (`$!`), kill it, and
confirm with `ps -p <pid>`. Before reporting done, `lsof -i :8000` must show nothing.

## Git workflow

> Human-authoritative: `CONTRIBUTING.md`. Keep in sync; never the *sole* home of a rule.

Everything starts as a GitHub issue and lands on `main` via a squash-merged PR. Never commit
directly to `main`: `main` is what GitHub Pages serves.

1. **Issue first**: one issue is one coherent, reviewable PR, and every PR can say `Closes #N`.
2. **One branch per issue**: `feat/<issue>-<slug>` or `fix/<issue>-<slug>`, from fresh `main`.
3. **PR** per `.github/PULL_REQUEST_TEMPLATE.md`; CI (`node --test`) green **on the head commit**
   before merge.
4. Review, squash-merge, delete the branch.

No back-compat shims or legacy fallbacks unless an issue asks for one (saved measurements excepted,
see Architecture).

## Writing style (issues, PR bodies, review comments)

The primary reader is a scientist who codes as a hobby, not as a career, and has said jargon-heavy
descriptions are hard to follow — even for code they wrote themselves. When describing a bug, a
change, or a review finding:

- **Lead with the concrete symptom, not the abstract mechanism**: say what actually goes wrong for
  the user, a file, or the data.
- **Give a real example**: a specific input, the wrong result it produced *before*, and the correct
  result *after*. Show actual values, not just categories.
- **Define any unavoidable technical term in one short clause** the first time it appears.
- **Plain language first, code detail second**: function names, file paths and line numbers come
  *after* the plain-English explanation, not instead of it.

Example: *good:* "Typing `0,6` for the isocentre pin showed *OK* although the tolerance is 0.5 mm:
everything after the comma was dropped, so the app judged 0 mm instead of 0.6 mm." *Avoid:*
"`parseFloat` stops at the locale decimal separator."

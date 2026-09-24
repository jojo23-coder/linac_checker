**Implement this issue yourself in the current session, end to end — do not ask whether to delegate to a subagent; just proceed.**

Read GitHub issue #$ARGUMENTS carefully using `gh issue view $ARGUMENTS --comments`. Study every detail — the description, acceptance criteria, and any linked resources.

If the issue references or includes images (screenshots, photos of the phone, a marked-up report), view them carefully and match the visual design precisely.

**Detect the target branch.** Scan the issue body for a line of the form `**Target branch:** <branch-name>` (case-insensitive, with or without backticks or bold markers). If present, set `BASE_BRANCH=<that-branch>`; if absent, `BASE_BRANCH=main`. State the detected `BASE_BRANCH` in your first user-facing update so the user can correct you.

Then:

1. **Create a feature branch from `BASE_BRANCH`.** `git checkout $BASE_BRANCH && git pull origin $BASE_BRANCH`, then a branch named per CLAUDE.md › Git workflow: `feat/<issue>-<slug>` or `fix/<issue>-<slug>`. Example: `feat/12-linac-5`.

2. **Plan your approach.** Before writing code, outline which files change and why, and share the plan briefly. Keep to CLAUDE.md › Architecture: pass/fail logic lives in `js/checks.js`, per-linac numbers in `js/linacs/`, and only `js/app.js` and `js/report.js` touch the DOM. If the issue adds or changes a reference value, a tolerance or instruction text, you need the source document (CLAUDE.md › Source documents) — ask the user for it rather than guessing a number.

3. **Implement the changes.** Follow CLAUDE.md conventions. Read existing files before modifying them. Keep changes minimal and focused on the issue. For each meaningful change, be ready to explain **why** — the intention behind the code should be clear to a reviewer reading the diff.

4. **Test and look — all must pass.**
   - `node --test` — the exit code is the verdict. Add or update tests for logic you change (`checks.js`, `protocol.js`, `store.js`, linac data).
   - A new file the page loads goes into `PRECACHE` in `sw.js` (the test reds otherwise), with `CACHE` bumped.
   - **Look at it in a browser at phone size** (390 × 844). Serve with `python3 -m http.server 8000` in the background, capturing its PID. For a static view, `"/Applications/Google Chrome.app/Contents/MacOS/Google Chrome" --headless --window-size=390,844 --screenshot=<scratchpad>/shot.png http://localhost:8000/`; when values must be typed first, drive the installed Chrome with Playwright (`playwright-core` installed in the scratchpad, `executablePath` pointing at Chrome). For a report change, print to PDF and read every page. Kill the server and confirm it is gone (CLAUDE.md › Processes you start).

5. **Commit with a clear message** that references the issue number. Example: `feat(report): add signature block (#12)`.

6. **Push the branch and create a PR targeting `BASE_BRANCH`** using `gh pr create --base $BASE_BRANCH`. The PR body **must** start with `Closes #$ARGUMENTS` on its own line. When `BASE_BRANCH` is not `main`, add one line noting that the issue closes when that branch lands on `main`.

   Then include (per `.github/PULL_REQUEST_TEMPLATE.md`, written per CLAUDE.md › Writing style):
   - **Intention & logic** — _why_ each change was made and _how_ the new code works, in natural language, so a reviewer can spot bugs early.
   - **What changed** — a clear summary of the concrete modifications.
   - **What's missing** — known limitations or follow-up work.
   - **How to test** — `node --test`, and how to serve it locally.
   - **Manual test method (required)** — explicit steps on a phone (or at phone width) with the expected result of each, e.g. "type `0,6` in *Isoc.pinne rotation* → red *Underkänd*". If nothing visible changed: `Manual test: Not applicable (no UI changes).`

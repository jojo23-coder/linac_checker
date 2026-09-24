# Contributing

Everything starts as a GitHub issue and lands on `main` via a squash-merged pull request —
never commit directly to `main`, because `main` is what GitHub Pages serves.

1. **Issue first.** Describe the symptom or the goal in plain language (see CLAUDE.md ›
   Writing style) with acceptance criteria. One issue is one reviewable PR; every PR must be
   able to say `Closes #N`.
2. **One branch per issue** — `feat/<issue>-<slug>` or `fix/<issue>-<slug>`, from fresh `main`.
3. **Test and look** before every push: `node --test` (the exit code is the verdict), and open
   the page at phone size. A report change is checked by printing it to PDF.
4. **Pull request** per `.github/PULL_REQUEST_TEMPLATE.md`, linked with `Closes #N`. CI must be
   green **on the head commit** at merge time. A changed reference value or tolerance names the
   workbook cell it came from.
5. **Review and squash-merge**; delete the branch.

No back-compat shims or legacy fallbacks unless an issue asks for one — except that saved
measurements are never silently dropped (CLAUDE.md › Architecture).

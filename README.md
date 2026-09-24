# Linac checker

Yearly check (*årskontroll*) of the Varian TrueBeam linacs, on a phone: enter the results in the
bunker, see each one judged against its tolerance as you type, read the instruction step for any
check without leaving the form, and print a PDF report at the end.

**App:** <https://jojo23-coder.github.io/linac_checker/>

Works offline once opened (add it to the home screen before going into the bunker). Results are
saved on the device; export a session as a file to move it to another device or keep a copy.

## Development

Plain HTML, CSS and JavaScript modules — no build step.

```bash
node --test                    # run the tests
python3 -m http.server 8000    # serve at http://localhost:8000
```

How the work is organised — issues, branches, pull requests, and the rules for code — is in
[CLAUDE.md](CLAUDE.md) and [CONTRIBUTING.md](CONTRIBUTING.md).

# DECISIONS.md — decisions taken during the run

Each entry records a decision that a reader could otherwise mistake for an
accident. Times and dates are UTC.

## D1 — The core is UMD-style, not ES modules

**Decision.** `core/*.js` use a small UMD wrapper: they export through
`module.exports` under Node and attach to `globalThis.Eisenhower` in a
browser.

**Why.** The web app must work from a `file://` URL (the definition of done
asks for an offline copy that works from disk). Browsers refuse to load ES
modules over `file://` because the origin is opaque, so the shared core is
loaded with classic `<script>` tags. The same files are then loadable by
`require()` in the Node test suite without a build step and without a
transpiler.

**Consequence.** The global namespace is `Eisenhower.<module>`. No bundler,
no `node_modules`, no runtime dependency.

## D2 — The extension stays at the repository root

**Decision.** `manifest.json`, `popup.html`, `matrix.html` and their assets
stay in the repository root so the repository can be loaded as an unpacked
Firefox extension without a packaging step.

**Why.** Firefox loads an unpacked extension from the directory that holds
`manifest.json`. A nested `extension/` folder would work too, but it would
force the web app to reference `../core/…`, which breaks when the site is
served under a sub-path such as `/eisenhower/`.

**Consequence.** The standalone web app (`index.html`) also lives at the root
and is the only page deployed to the VPS. The deployed directory holds
`index.html`, `app.css` and `core/`; the extension files are not deployed.

## D3 — Ordered numbering accepts nested markers

**Decision.** The paste parser strips `1.`, `1)`, `1/` and the nested forms
such as `1.2.3 `.

**Why.** The paste parser is meant to swallow the noise of copied lists, and
spreadsheets and wikis use both the flat and the nested forms. The risk is a
line that legitimately starts with a number and a dot, for example
`3.5 kg of flour`; that line becomes `kg of flour`. The alternative — only
stripping the flat forms — loses more real list markers than it saves.

**Consequence.** Documented in the README under "Paste parser".

## D4 — `normaliseLine` returns the text, `parseLine` returns the flags

**Decision.** `parser.normaliseLine(line)` returns the cleaned text (or
`null`), and `parser.parseLine(line)` returns `{ text, completed }`.

**Why.** The text is what a caller usually wants; the completion flag is
only needed when the checkbox marker must be preserved.

## D5 — A legacy payload that is not a string is still migrated

**Decision.** `persistence.readLegacy()` accepts both a JSON string and a
live array for the legacy `tasks` key.

**Why.** A Web Storage always returns a string, but the migration must never
lose a task, whatever the shape of the value it finds. The unit test that
covers the migration uses a live array, so the tolerant read keeps the
"no task is lost" promise for both shapes.

## D6 — The `seq` tie breaker is not enumerable

**Decision.** The store keeps an internal sequence number on every task to
keep a stable order when two tasks share the same `order`, but the property
is defined as non-enumerable.

**Why.** The task model is shared with the persistence layer and the import
and export formats; an internal field must never leak into a saved payload
or into a CSV column.

## D7 — The deployment is prepared in the repository, applied by a human

**Decision.** The systemd unit and the nginx snippet live in `deploy/` in
the repository, and the exact commands to apply them are recorded in
`CHECKS.md`.

**Why.** The agent rules forbid `ssh`, `scp` and `sudo` from the agent's
shell, and `mox vps allow eisenhower-matrix` is a one-time human action.
The deploy is therefore prepared, reviewed and applied by the owner; the
commands are exact so that the step takes a minute.

**Consequence.** The site is not live until the owner runs the commands in
`CHECKS.md`. This is recorded in `STATUS.md` as the only outstanding item.

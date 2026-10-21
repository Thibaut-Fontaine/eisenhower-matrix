# STATUS.md — eisenhower-matrix

Last update: 2026-10-21.

## What works

* **The shared core** (`core/`) is dependency-free and build-free: the task
  model, the paste parser, the store, the versioned persistence layer, the
  JSON and CSV interchange, the renderer, the drag state machine, the
  keyboard flow and the application controller.
* **The specs**: 127 tests pass with the test runner of Node
  (`npm run check` runs the syntax check and the tests). They cover the
  parser, the store, the persistence layer, the interchange formats, the
  renderer, the drag, the keyboard, the controller and the pages.
* **The standalone web app** (`index.html`) works offline from a `file://`
  URL and renders a responsive two by two grid. A smoke test runs the real
  page in a real browser (`test/fixtures/browser-smoke.html`): every check
  passes.
* **The Firefox extension** keeps its Manifest V2 structure, with no
  permission at all. The popup is the compact view (add, tick, move, delete,
  open the full matrix) and `matrix.html` is the full application, built on
  the same core as the web app.
* **The keyboard path**: a task is picked up with `Space`, moved with the
  arrow keys and dropped with `Space`; `Escape` cancels. The state is
  announced in a live region and the carried task carries
  `aria-grabbed="true"`.
* **No markup from the user text**: the tasks are inserted with
  `textContent`; the legacy `innerHTML` rendering is gone, and a test
  refuses any use of `innerHTML`.
* **The legacy data**: the tasks of the old extension (`tasks` key) are
  migrated once into the versioned store; a failed write leaves the old data
  untouched, and a broken payload is kept as a backup.
* **The deployment is prepared**: `deploy/` holds the systemd unit (bound to
  `127.0.0.1:8792`), the nginx location for `/eisenhower/` and the install
  script, which runs `nginx -t` before the reload and touches no other site.

## What is untested or unverified

* **The site is not live yet.** The agent cannot reach the VPS: `ssh`,
  `scp` and `sudo` are blocked by the guardrails, and the approval
  (`mox vps allow eisenhower-matrix`) is a one-time human action. The exact
  commands are in `deploy/README.md` and in `CHECKS.md`.
* **The extension was not loaded in Firefox.** The pages were checked in a
  headless browser (Chrome), not in Firefox, and the manifest was not
  validated by `web-ext`. Firefox still has to be checked by hand.
* **The drag and drop was not exercised with a real pointer.** The state
  machine and the geometry are covered by the specs, and the pointer events
  are wired, but no automated test drives a real drag.
* **The subdomain** `eisenhower.thibautfontaine.space` does not resolve, so
  the site is prepared under `thibautfontaine.space/eisenhower/`. A
  certificate and a server name would need the DNS record and certbot.

## The three next steps

1. **Deploy the site.** Copy the web files to the server and run
   `deploy/deploy.sh` (the exact commands are in `deploy/README.md` and in
   `CHECKS.md`), then check `https://thibautfontaine.space/eisenhower/`.
2. **Check the extension in Firefox**: load the unpacked extension, open the
   popup and the full matrix, and add, move, complete and delete a task.
3. **Decide about the subdomain**: create the DNS record for
   `eisenhower.thibautfontaine.space`, add a server name and a certificate
   with certbot, and point the nginx location at it.

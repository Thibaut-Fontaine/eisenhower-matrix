# Eisenhower Matrix

A small task matrix: the four Eisenhower quadrants, a modern and accessible
interface, and **no account, no server, no tracking**. The tasks live in the
local storage of the browser and nowhere else.

The same application ships in two shapes, both driven by the same core:

* a **Firefox extension** with a compact popup and a full matrix page;
* a **standalone web app** that also works offline, from a file on a disk.

```
core/          the shared core: task model, paste parser, store, persistence
index.html     the standalone web app
matrix.html    the full matrix page of the extension
popup.html     the compact popup of the extension
deploy/        the systemd unit, the nginx location and the install script
test/          the specs, run with the Node test runner
```

## The quadrants

| Quadrant | Meaning |
|---|---|
| **Do now** | important and urgent |
| **Schedule** | important, not urgent |
| **Delegate** | not important, urgent |
| **Eliminate** | neither important nor urgent |

Every quadrant has a count, a list of the tasks that are still open and a
folded section with the tasks that are done.

## Install the Firefox extension

The extension is a plain Manifest V2 extension with **no permission at all**:
it only writes into the local storage of the browser.

1. Open Firefox and go to `about:debugging#/runtime/this-firefox`.
2. Click **Load Temporary Add-on…**.
3. Pick the `manifest.json` of this repository.

The extension is then in the toolbar:

* the **popup** shows a compact list: add a task, tick it off, move it to
  another quadrant or delete it, and open the full matrix;
* the **full matrix** (`matrix.html`) is the whole application: the grid, the
  drag and drop, the keyboard, the paste panel and the import and export.

The tasks of the extension and the tasks of the web app are **not** the same
data: the two surfaces have different storage origins. Export from one and
import into the other to move the tasks across.

## Use the web app

The web app is a static page: open `index.html` in a browser, and it works
offline, straight from the disk.

It is also published on the server of the owner:

```
https://thibautfontaine.space/eisenhower/
```

## What you can do

* **Add** a task with the form at the top; the quadrant of the new task is
  chosen in the list next to the field.
* **Edit** a task with its *Edit* button; the field appears in place, *Enter*
  saves it and *Escape* leaves it as it was.
* **Complete** a task with its box; it moves to the folded *Completed* section
  of its quadrant.
* **Delete** a task with its *Delete* button.
* **Move** a task by dragging its handle (`⠿`) to another quadrant, or with
  the keyboard alone.
* **Paste a list** to turn a block of text into many tasks at once, and
  choose the quadrant of each line in the preview.
* **Import** and **export** the tasks as JSON or as CSV.

## The keyboard

Every task can be reached with the *Tab* key. The keyboard path is the same
as the drag and drop, and it is announced by the screen reader.

| Key | Action |
|---|---|
| `Tab` | move the focus to the next task |
| `Space` or `Enter` | pick a task up, or drop the task you carry |
| `↑` `↓` | move the task inside its list; at the end of the list it crosses into the row below (or above) |
| `←` `→` | move the task to the column on the left (urgent) or on the right (not urgent) |
| `Escape` | cancel the move |
| `Delete` | delete the task |

The state is read out in the live region at the bottom of the page, and the
task you carry is marked with `aria-grabbed="true"`.

## The paste parser

The paste panel takes any block of text and turns it into tasks. The parser
removes the noise of a copied list:

* the bullet markers `-`, `*`, `+`, `•`;
* the numbering `1.`, `1)`, `1/` and the nested forms such as `1.2.3`;
* the checkboxes `[ ]`, `[x]` and `[✓]` — a ticked box marks the task as done;
* the markdown headings `# Heading` and the block quotes `> quote`;
* the emphasis `**bold**`, `*italic*`, `__bold__`, `~~struck~~` and `` `code` ``;
* the spaces around the line.

The lines that are empty, and the lines that repeat an earlier line (the
comparison ignores the case and the repeated spaces), are dropped. The first
occurrence is kept.

The parser is deliberately simple: a line that starts with a number and a dot
is read as a numbered item, so `3.5 kg of flour` becomes `kg of flour`.

## The import and export format

**JSON** — the full backup, with a version:

```json
{
  "version": 1,
  "exportedAt": "2026-10-21T09:00:00.000Z",
  "tasks": [
    {
      "id": "t-l3k4j2-1-abc",
      "text": "buy milk",
      "quadrant": "important-urgent",
      "completed": false,
      "order": 0
    }
  ]
}
```

**CSV** — one line per task, with the header `id,text,quadrant,completed,order`:

```csv
id,text,quadrant,completed,order
t-l3k4j2-1-abc,buy milk,important-urgent,false,0
```

The text of a task may hold commas, quotes and newlines: the fields that
need it are quoted and the quotes are doubled, as RFC 4180 asks. The
import accepts a CSV with or without the header row, and a JSON file with
or without the `tasks` wrapper.

The import **adds** the tasks to the matrix; it never removes what is
already there. The tasks that are already known keep their identity, the
others get a new one.

## Where the data lives

The tasks are stored in the `localStorage` of the browser, under the key
`eisenhower.matrix.tasks`. Nothing is sent anywhere: there is no account, no
server storage, no analytics and no third party script.

The tasks of the **old version** of the extension, which were stored under
the key `tasks`, are moved to the new format the first time the application
starts. The move happens once and never loses a task; if the write fails, the
old data is left untouched and the move is tried again later. A stored
payload that cannot be read is kept under
`eisenhower.matrix.tasks.corrupt` before it is replaced.

Clearing the data of the site in the browser erases the tasks. Export them
first if you want to keep a copy.

## The security of the rendering

The text of a task is **never** turned into markup: it is always inserted
with `textContent`. The old version of the extension built its list with
`innerHTML`, and a task such as `<img src=x onerror=…>` could have run in the
page. That code is gone, and a test checks that no file of the project uses
`innerHTML`.

## Develop

The project has **no dependency** and **no build step**: the files that the
browser runs are the files of the repository.

```bash
npm test          # the specs, with the test runner of Node
npm run lint      # the syntax of every file
npm run check     # both
```

The specs cover the paste parser, the store, the persistence layer, the
import and export, the renderer, the drag, the keyboard and the controller
of the application. A small DOM double (`test/helpers/dom.mjs`) stands in for
the browser; it refuses `innerHTML`, so a test fails as soon as the code
tries to build markup.

A smoke test runs the real page in a real browser:

```bash
google-chrome --headless --dump-dom test/fixtures/browser-smoke.html | grep -E 'PASS|FAIL'
```

## Deploy the web app

The deployment is described in [`deploy/README.md`](deploy/README.md): a
systemd unit serves the static files on `127.0.0.1:8792` and the existing
nginx proxies `/eisenhower/` to it. The script checks the nginx
configuration with `nginx -t` before the reload, and no other site is
touched.

## Licence

MIT.

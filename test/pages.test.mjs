/**
 * Page and manifest specs.
 *
 * The pages are the entry points of the extension and of the web app: they
 * must load the core in the right order, they must not build markup from
 * user text, and the manifest must stay a valid Manifest V2.
 */
import test from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync, existsSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { dirname, join } from 'node:path';

const root = join(dirname(fileURLToPath(import.meta.url)), '..');

const read = (file) => readFileSync(join(root, file), 'utf8');

const CORE_ORDER = [
  'core/quadrants.js',
  'core/task.js',
  'core/parser.js',
  'core/store.js',
  'core/persistence.js',
  'core/interchange.js',
  'core/render.js',
  'core/drag.js',
  'core/keyboard.js',
  'core/app.js'
];

function scriptsOf(html) {
  const found = [];
  const pattern = /<script[^>]*src="([^"]+)"/g;
  let match = pattern.exec(html);
  while (match) {
    found.push(match[1]);
    match = pattern.exec(html);
  }
  return found;
}

for (const page of ['index.html', 'matrix.html', 'popup.html']) {
  test(`${page} loads the core in the dependency order`, () => {
    const scripts = scriptsOf(read(page));
    const core = scripts.filter((src) => src.startsWith('core/'));
    assert.deepEqual(core, CORE_ORDER);
  });

  test(`${page} loads files that exist`, () => {
    for (const src of scriptsOf(read(page))) {
      assert.ok(existsSync(join(root, src)), `${src} is missing`);
    }
  });

  test(`${page} never builds markup from text`, () => {
    assert.equal(read(page).includes('innerHTML'), false);
  });
}

test('the pages of the extension and of the web app share the same boot script', () => {
  for (const page of ['index.html', 'matrix.html', 'popup.html']) {
    assert.ok(scriptsOf(read(page)).includes('boot.js'), `${page} boots the application`);
  }
});

test('the manifest is a valid Manifest V2 with the least permissions', () => {
  const manifest = JSON.parse(read('manifest.json'));
  assert.equal(manifest.manifest_version, 2);
  assert.equal(manifest.browser_action.default_popup, 'popup.html');
  assert.deepEqual(manifest.permissions, [], 'the application needs no permission');
  assert.ok(existsSync(join(root, manifest.browser_action.default_popup)));
  assert.ok(existsSync(join(root, 'matrix.html')));
});

test('no file of the project builds markup from the task text', () => {
  for (const file of [...CORE_ORDER, 'boot.js']) {
    assert.equal(read(file).includes('.innerHTML'), false, `${file} must not use innerHTML`);
  }
});

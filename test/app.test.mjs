/**
 * Application specs: the controller that wires the core to a page.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import appModule from '../core/app.js';
import persistence from '../core/persistence.js';
import { createDocument, DomEvent } from './helpers/dom.mjs';
import { createMemoryStorage } from './helpers/storage.mjs';

const { createApp } = appModule;
const { STORAGE_KEY, LEGACY_KEY } = persistence;

function setup(initial = {}) {
  const doc = createDocument();
  const storage = createMemoryStorage(initial);
  const mount = doc.createElement('div');
  doc.body.appendChild(mount);
  const app = createApp({ document: doc, storage, mount, options: {} });
  return { doc, storage, mount, app };
}

function submit(doc, form) {
  form.dispatchEvent(new DomEvent('submit', { target: form }));
}

function press(doc, node, key) {
  node.dispatchEvent(new DomEvent('keydown', { key, target: node }));
}

test('adds a task from the form', () => {
  const { doc, app, storage } = setup();
  const form = app.view.root.parentNode.querySelector('.add-form');
  form.querySelector('.add-input').value = '  buy milk  ';
  submit(doc, form);
  assert.equal(app.store.all().length, 1);
  assert.equal(app.store.all()[0].text, 'buy milk');
  assert.ok(storage.getItem(STORAGE_KEY), 'the task was saved');
});

test('refuses an empty task', () => {
  const { doc, app } = setup();
  const form = app.view.root.parentNode.querySelector('.add-form');
  form.querySelector('.add-input').value = '   ';
  submit(doc, form);
  assert.equal(app.store.all().length, 0);
});

test('completes and deletes a task from the matrix', () => {
  const { app } = setup();
  app.addTask('buy milk', 'important-urgent');
  const item = app.view.root.querySelector('.task');
  item.querySelector('.task-complete').click();
  assert.equal(app.store.get(item.getAttribute('data-task-id')).completed, true);
  item.querySelector('.task-action[data-action="delete"]').click();
  assert.equal(app.store.all().length, 0);
});

test('edits the text of a task', () => {
  const { doc, app } = setup();
  app.addTask('buy milk', 'important-urgent');
  const item = app.view.root.querySelector('.task');
  item.querySelector('.task-action[data-action="edit"]').click();
  const input = app.view.root.querySelector('.task-edit');
  assert.ok(input, 'the task is edited in place');
  input.value = 'buy oat milk';
  app.view.root.querySelector('.task-action[data-action="save"]').click();
  assert.equal(app.store.all()[0].text, 'buy oat milk');
});

test('moves a task with the keyboard alone', () => {
  const { doc, app } = setup();
  app.addTask('buy milk', 'important-urgent');
  const item = app.view.root.querySelector('.task');
  press(doc, item, ' ');
  assert.equal(app.store.get(item.getAttribute('data-task-id')).quadrant, 'important-urgent');
  press(doc, item, 'ArrowRight');
  press(doc, item, ' ');
  assert.equal(app.store.get(item.getAttribute('data-task-id')).quadrant, 'important-not-urgent');
});

test('the escape key cancels a keyboard move', () => {
  const { doc, app } = setup();
  app.addTask('buy milk', 'important-urgent');
  const item = app.view.root.querySelector('.task');
  press(doc, item, ' ');
  press(doc, item, 'ArrowRight');
  press(doc, item, 'Escape');
  press(doc, item, ' ');
  assert.equal(app.store.get(item.getAttribute('data-task-id')).quadrant, 'important-urgent');
});

test('imports a CSV payload', () => {
  const { app } = setup();
  const ok = app.importText('id,text,quadrant,completed,order\r\na,buy milk,important-urgent,false,0\r\n');
  assert.equal(ok, true);
  assert.equal(app.store.all().length, 1);
  assert.equal(app.store.all()[0].text, 'buy milk');
});

test('refuses a broken payload', () => {
  const { app } = setup();
  assert.equal(app.importText('{not json'), false);
  assert.equal(app.store.all().length, 0);
});

test('exports the tasks as JSON and as CSV', () => {
  const { app } = setup();
  app.addTask('buy milk', 'important-urgent');
  assert.match(app.exportText('json'), /buy milk/);
  assert.match(app.exportText('csv'), /buy milk/);
});

test('migrates the tasks of the old extension on the first run', () => {
  const legacy = [
    { task: 'buy milk', important: true, urgent: true },
    { task: 'walk', important: false, urgent: false }
  ];
  const { app, storage } = setup({ tasks: JSON.stringify(legacy) });
  assert.equal(app.store.all().length, 2);
  assert.equal(storage.getItem(LEGACY_KEY), null, 'the legacy key is consumed');
  assert.ok(storage.getItem(STORAGE_KEY), 'the tasks are stored in the new format');
});

test('the compact view lists the tasks of every quadrant', () => {
  const doc = createDocument();
  const storage = createMemoryStorage();
  const mount = doc.createElement('div');
  doc.body.appendChild(mount);
  const app = createApp({ document: doc, storage, mount, options: { compact: true } });
  app.addTask('buy milk', 'important-urgent');
  const item = app.view.root.querySelector('.compact-task');
  assert.equal(item.querySelector('.task-text').textContent, 'buy milk');
  assert.ok(item.querySelector('.move-select'));
  assert.ok(item.querySelector('.task-action[data-action="delete"]'));
});

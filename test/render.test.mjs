/**
 * Rendering specs.
 *
 * The renderer must build the matrix with the DOM API only: the user text is
 * always inserted as text, never as markup.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import render from '../core/render.js';
import storeModule from '../core/store.js';
import { createDocument } from './helpers/dom.mjs';

const { createMatrixView, createTaskItem } = render;
const { TaskStore } = storeModule;

function makeStore() {
  let counter = 0;
  return new TaskStore({ idFactory: () => `id-${++counter}` });
}

test('the matrix has one section per quadrant', () => {
  const doc = createDocument();
  const view = createMatrixView(doc);
  view.update(makeStore(), {});
  const sections = view.root.querySelectorAll('.quadrant');
  assert.equal(sections.length, 4);
  const ids = sections.map((section) => section.getAttribute('data-quadrant'));
  assert.deepEqual(ids, [
    'important-urgent',
    'important-not-urgent',
    'not-important-urgent',
    'not-important-not-urgent'
  ]);
});

test('every quadrant has a title, a description and a count', () => {
  const doc = createDocument();
  const view = createMatrixView(doc);
  view.update(makeStore(), {});
  const section = view.root.querySelector('[data-quadrant="important-urgent"]');
  assert.equal(section.querySelector('.quadrant-title').textContent, 'Do now');
  assert.equal(section.querySelector('.quadrant-description').textContent, 'Important and urgent');
  assert.equal(section.querySelector('.quadrant-count').textContent, '0');
});

test('the count follows the number of active tasks', () => {
  const doc = createDocument();
  const store = makeStore();
  store.add('one', { quadrant: 'important-urgent' });
  store.add('two', { quadrant: 'important-urgent' });
  const view = createMatrixView(doc);
  view.update(store, {});
  const section = view.root.querySelector('[data-quadrant="important-urgent"]');
  assert.equal(section.querySelector('.quadrant-count').textContent, '2');
});

test('a task is rendered with its text, a checkbox and the actions', () => {
  const doc = createDocument();
  const store = makeStore();
  const task = store.add('buy milk', { quadrant: 'important-urgent' });
  const view = createMatrixView(doc);
  view.update(store, {});
  const item = view.root.querySelector(`[data-task-id="${task.id}"]`);
  assert.ok(item);
  assert.equal(item.querySelector('.task-text').textContent, 'buy milk');
  assert.ok(item.querySelector('.task-complete'));
  assert.equal(item.querySelector('.task-action[data-action="edit"]').getAttribute('type'), 'button');
  assert.equal(item.querySelector('.task-action[data-action="delete"]').getAttribute('type'), 'button');
  assert.equal(item.getAttribute('tabindex'), '0');
});

test('the text of a task is never inserted as markup', () => {
  const doc = createDocument();
  const store = makeStore();
  store.add('<img src=x onerror=alert(1)>', { quadrant: 'important-urgent' });
  const view = createMatrixView(doc);
  view.update(store, {});
  const item = view.root.querySelector('.task');
  assert.equal(item.querySelector('.task-text').textContent, '<img src=x onerror=alert(1)>');
  assert.equal(item.querySelectorAll('img').length, 0, 'no element was created from the text');
});

test('the renderer refuses to use innerHTML', () => {
  const doc = createDocument();
  const element = doc.createElement('div');
  assert.throws(() => {
    element.innerHTML = '<b>nope</b>';
  }, /innerHTML/);
});

test('the completed tasks go to the completed section', () => {
  const doc = createDocument();
  const store = makeStore();
  const done = store.add('old', { quadrant: 'important-urgent' });
  store.add('new', { quadrant: 'important-urgent' });
  store.setCompleted(done.id, true);
  const view = createMatrixView(doc);
  view.update(store, {});
  const section = view.root.querySelector('[data-quadrant="important-urgent"]');
  const active = section.querySelectorAll('.task-list .task');
  const completed = section.querySelectorAll('.completed-list .task');
  assert.equal(active.length, 1);
  assert.equal(completed.length, 1);
  assert.equal(completed[0].getAttribute('data-task-id'), done.id);
  assert.equal(section.querySelector('.completed-count').textContent, '1');
});

test('a completed task shows the completed state', () => {
  const doc = createDocument();
  const store = makeStore();
  const done = store.add('old', { quadrant: 'important-urgent' });
  store.setCompleted(done.id, true);
  const view = createMatrixView(doc);
  view.update(store, {});
  const item = view.root.querySelector(`[data-task-id="${done.id}"]`);
  assert.equal(item.getAttribute('aria-grabbed'), 'false');
  assert.equal(item.querySelector('.task-complete').checked, true);
});

test('the task item exposes the actions through data attributes', () => {
  const doc = createDocument();
  const item = createTaskItem(doc, { id: 'a', text: 'buy milk', completed: false });
  assert.equal(item.getAttribute('data-task-id'), 'a');
  assert.equal(item.getAttribute('role'), 'listitem');
  assert.equal(item.getAttribute('aria-grabbed'), 'false');
  assert.equal(item.querySelector('.task-text').textContent, 'buy milk');
});

test('the view can be updated without recreating the root', () => {
  const doc = createDocument();
  const store = makeStore();
  const view = createMatrixView(doc);
  view.update(store, {});
  const first = view.root.querySelectorAll('.quadrant')[0];
  store.add('one', { quadrant: 'important-urgent' });
  view.update(store, {});
  const second = view.root.querySelectorAll('.quadrant')[0];
  assert.equal(first, second, 'the sections are reused');
  assert.equal(second.querySelectorAll('.task').length, 1);
});

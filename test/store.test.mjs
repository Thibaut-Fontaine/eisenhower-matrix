/**
 * Task store specs: add, edit, delete, complete, move and reorder.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import store from '../core/store.js';

const { TaskStore } = store;

function makeStore() {
  let counter = 0;
  return new TaskStore({ idFactory: () => `id-${++counter}` });
}

test('adds a task with a trimmed text and a quadrant', () => {
  const s = makeStore();
  const task = s.add('  buy milk  ', { quadrant: 'important-urgent' });
  assert.equal(task.text, 'buy milk');
  assert.equal(task.quadrant, 'important-urgent');
  assert.equal(task.completed, false);
  assert.equal(task.order, 0);
  assert.ok(task.id);
});

test('rejects empty text and unknown quadrants', () => {
  const s = makeStore();
  assert.throws(() => s.add('   '), TypeError);
  assert.throws(() => s.add('ok', { quadrant: 'nope' }), TypeError);
});

test('adds many tasks at once', () => {
  const s = makeStore();
  const added = s.addMany([
    { text: 'one', quadrant: 'important-urgent' },
    { text: 'two', quadrant: 'not-important-urgent' }
  ]);
  assert.equal(added.length, 2);
  assert.equal(s.all().length, 2);
});

test('edits the text of a task', () => {
  const s = makeStore();
  const task = s.add('buy milk', { quadrant: 'important-urgent' });
  const updated = s.update(task.id, { text: 'buy oat milk' });
  assert.equal(updated.text, 'buy oat milk');
  assert.equal(s.get(task.id).text, 'buy oat milk');
});

test('editing to an empty text throws and leaves the task untouched', () => {
  const s = makeStore();
  const task = s.add('buy milk', { quadrant: 'important-urgent' });
  assert.throws(() => s.update(task.id, { text: '  ' }), TypeError);
  assert.equal(s.get(task.id).text, 'buy milk');
});

test('deletes a task', () => {
  const s = makeStore();
  const task = s.add('buy milk', { quadrant: 'important-urgent' });
  assert.equal(s.remove(task.id), true);
  assert.equal(s.get(task.id), null);
  assert.equal(s.all().length, 0);
  assert.equal(s.remove('missing'), false);
});

test('completes and un-completes a task', () => {
  const s = makeStore();
  const task = s.add('buy milk', { quadrant: 'important-urgent' });
  s.setCompleted(task.id, true);
  assert.equal(s.get(task.id).completed, true);
  assert.equal(s.list('important-urgent').length, 0);
  assert.equal(s.completedList('important-urgent').length, 1);
  s.setCompleted(task.id, false);
  assert.equal(s.get(task.id).completed, false);
  assert.equal(s.list('important-urgent').length, 1);
});

test('toggles the completion flag', () => {
  const s = makeStore();
  const task = s.add('buy milk', { quadrant: 'important-urgent' });
  s.toggleComplete(task.id);
  assert.equal(s.get(task.id).completed, true);
  s.toggleComplete(task.id);
  assert.equal(s.get(task.id).completed, false);
});

test('moves a task to another quadrant', () => {
  const s = makeStore();
  const task = s.add('buy milk', { quadrant: 'important-urgent' });
  s.move(task.id, 'not-important-urgent');
  assert.equal(s.get(task.id).quadrant, 'not-important-urgent');
  assert.equal(s.list('important-urgent').length, 0);
  assert.equal(s.list('not-important-urgent').length, 1);
});

test('keeps the ordering stable after a move', () => {
  const s = makeStore();
  const a = s.add('a', { quadrant: 'important-urgent' });
  const b = s.add('b', { quadrant: 'important-urgent' });
  const c = s.add('c', { quadrant: 'important-urgent' });
  s.move(b.id, 'not-important-urgent');
  assert.deepEqual(s.list('important-urgent').map((t) => t.text), ['a', 'c']);
  assert.deepEqual(s.list('important-urgent').map((t) => t.order), [0, 1]);
  assert.deepEqual(s.list('not-important-urgent').map((t) => t.text), ['b']);
  assert.deepEqual(s.list('not-important-urgent').map((t) => t.order), [0]);
  assert.deepEqual([a.id, b.id, c.id].map((id) => s.get(id).order), [0, 0, 1]);
});

test('moves a task at a given index inside the target quadrant', () => {
  const s = makeStore();
  const a = s.add('a', { quadrant: 'important-urgent' });
  const b = s.add('b', { quadrant: 'important-urgent' });
  s.add('c', { quadrant: 'important-urgent' });
  s.move(a.id, 'important-urgent', 2);
  assert.deepEqual(s.list('important-urgent').map((t) => t.text), ['b', 'a', 'c']);
  assert.deepEqual(s.list('important-urgent').map((t) => t.order), [0, 1, 2]);
});

test('reorders the tasks of a quadrant', () => {
  const s = makeStore();
  const a = s.add('a', { quadrant: 'important-urgent' });
  const b = s.add('b', { quadrant: 'important-urgent' });
  const c = s.add('c', { quadrant: 'important-urgent' });
  s.reorder('important-urgent', [c.id, a.id, b.id]);
  assert.deepEqual(s.list('important-urgent').map((t) => t.text), ['c', 'a', 'b']);
  assert.deepEqual(s.list('important-urgent').map((t) => t.order), [0, 1, 2]);
});

test('ignores unknown ids in a reorder request', () => {
  const s = makeStore();
  const a = s.add('a', { quadrant: 'important-urgent' });
  const b = s.add('b', { quadrant: 'important-urgent' });
  s.reorder('important-urgent', ['missing', b.id, a.id]);
  assert.deepEqual(s.list('important-urgent').map((t) => t.text), ['b', 'a']);
});

test('counts the tasks per quadrant', () => {
  const s = makeStore();
  s.add('a', { quadrant: 'important-urgent' });
  s.add('b', { quadrant: 'important-urgent' });
  const done = s.add('c', { quadrant: 'important-urgent' });
  s.setCompleted(done.id, true);
  const counts = s.counts();
  assert.equal(counts['important-urgent'].total, 3);
  assert.equal(counts['important-urgent'].active, 2);
  assert.equal(counts['important-urgent'].completed, 1);
});

test('clears the completed tasks of a quadrant', () => {
  const s = makeStore();
  s.add('a', { quadrant: 'important-urgent' });
  const done = s.add('b', { quadrant: 'important-urgent' });
  s.setCompleted(done.id, true);
  s.clearCompleted('important-urgent');
  assert.equal(s.all().length, 1);
});

test('notifies subscribers on every change', () => {
  const s = makeStore();
  let calls = 0;
  const off = s.subscribe(() => { calls += 1; });
  const task = s.add('a', { quadrant: 'important-urgent' });
  s.update(task.id, { text: 'b' });
  s.setCompleted(task.id, true);
  s.remove(task.id);
  assert.equal(calls, 4);
  off();
  s.add('c', { quadrant: 'important-urgent' });
  assert.equal(calls, 4);
});

test('rejects an unknown task id', () => {
  const s = makeStore();
  assert.throws(() => s.update('missing', { text: 'x' }), TypeError);
  assert.throws(() => s.move('missing', 'important-urgent'), TypeError);
  assert.throws(() => s.setCompleted('missing', true), TypeError);
});

test('serialises the tasks back to plain objects', () => {
  const s = makeStore();
  s.add('a', { quadrant: 'important-urgent' });
  const json = JSON.parse(JSON.stringify(s.all()));
  assert.deepEqual(Object.keys(json[0]).sort(), ['completed', 'id', 'order', 'quadrant', 'text']);
});

/**
 * Drag and drop specs: the drag state machine and the pointer geometry.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import drag from '../core/drag.js';

const { createDragState, beginDrag, updateDrag, endDrag, cancelDrag, dragAnnouncement, hitQuadrant, insertionIndex } = drag;

test('a new drag state is idle', () => {
  const state = createDragState();
  assert.equal(state.active, false);
  assert.equal(state.taskId, null);
});

test('beginning a drag remembers the task and its origin', () => {
  const state = createDragState();
  beginDrag(state, { taskId: 'a', quadrantId: 'important-urgent', index: 0 });
  assert.equal(state.active, true);
  assert.equal(state.taskId, 'a');
  assert.equal(state.fromQuadrant, 'important-urgent');
  assert.equal(state.toQuadrant, 'important-urgent');
});

test('updating a drag moves the target', () => {
  const state = createDragState();
  beginDrag(state, { taskId: 'a', quadrantId: 'important-urgent', index: 0 });
  updateDrag(state, { quadrantId: 'not-important-urgent', index: 2 });
  assert.equal(state.toQuadrant, 'not-important-urgent');
  assert.equal(state.index, 2);
});

test('ending a drag returns the move and resets the state', () => {
  const state = createDragState();
  beginDrag(state, { taskId: 'a', quadrantId: 'important-urgent', index: 0 });
  updateDrag(state, { quadrantId: 'not-important-urgent', index: 1 });
  const result = endDrag(state);
  assert.deepEqual(result, {
    taskId: 'a',
    fromQuadrant: 'important-urgent',
    toQuadrant: 'not-important-urgent',
    index: 1
  });
  assert.equal(state.active, false);
  assert.equal(state.taskId, null);
});

test('ending an idle drag returns null', () => {
  assert.equal(endDrag(createDragState()), null);
});

test('cancelling a drag resets the state without a move', () => {
  const state = createDragState();
  beginDrag(state, { taskId: 'a', quadrantId: 'important-urgent', index: 0 });
  cancelDrag(state);
  assert.equal(state.active, false);
  assert.equal(state.taskId, null);
});

test('the drag announcement names the task and the target', () => {
  const state = createDragState();
  beginDrag(state, { taskId: 'a', quadrantId: 'important-urgent', index: 0 });
  updateDrag(state, { quadrantId: 'not-important-urgent', index: 1 });
  const message = dragAnnouncement(state, 'buy milk');
  assert.match(message, /buy milk/);
  assert.match(message, /Delegate/);
});

test('finds the quadrant under a point', () => {
  const rects = [
    { id: 'important-urgent', x: 0, y: 0, width: 100, height: 100 },
    { id: 'important-not-urgent', x: 100, y: 0, width: 100, height: 100 },
    { id: 'not-important-urgent', x: 0, y: 100, width: 100, height: 100 }
  ];
  assert.equal(hitQuadrant(rects, { x: 10, y: 10 }), 'important-urgent');
  assert.equal(hitQuadrant(rects, { x: 150, y: 10 }), 'important-not-urgent');
  assert.equal(hitQuadrant(rects, { x: 10, y: 150 }), 'not-important-urgent');
  assert.equal(hitQuadrant(rects, { x: 500, y: 500 }), null);
});

test('computes the insertion index from the task rectangles', () => {
  const tasks = [
    { x: 0, y: 0, width: 100, height: 20 },
    { x: 0, y: 20, width: 100, height: 20 },
    { x: 0, y: 40, width: 100, height: 20 }
  ];
  assert.equal(insertionIndex(tasks, { x: 5, y: 5 }), 0);
  assert.equal(insertionIndex(tasks, { x: 5, y: 25 }), 1);
  assert.equal(insertionIndex(tasks, { x: 5, y: 45 }), 2);
  assert.equal(insertionIndex(tasks, { x: 5, y: 200 }), 3);
});

test('the insertion index of an empty list is zero', () => {
  assert.equal(insertionIndex([], { x: 0, y: 0 }), 0);
});

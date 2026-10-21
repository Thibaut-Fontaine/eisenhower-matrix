/**
 * Keyboard specs: the grab, move and drop flow that works without a pointer.
 *
 * The vertical keys move the carried task inside its list; when the task is
 * already at the end of the list it crosses into the row below (or above).
 * The horizontal keys cross the columns. The size of every list is given by
 * the `listSize` callback, which the application reads from the store.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import keyboard from '../core/keyboard.js';

const { keyAction, createKeyboardSession, KEYBOARD_HELP } = keyboard;

const press = (key, extra = {}) => ({ key, shiftKey: false, ctrlKey: false, metaKey: false, altKey: false, ...extra });

/** A session whose lists hold the given number of tasks. */
function sessionWith(sizes) {
  return createKeyboardSession({
    listSize: (quadrantId) => (sizes[quadrantId] === undefined ? Infinity : sizes[quadrantId])
  });
}

test('space grabs and drops a task', () => {
  assert.equal(keyAction(press(' ')), 'grab');
  assert.equal(keyAction(press('Spacebar')), 'grab');
  assert.equal(keyAction(press('Enter')), 'grab');
});

test('escape cancels', () => {
  assert.equal(keyAction(press('Escape')), 'cancel');
});

test('the arrow keys move a grabbed task', () => {
  assert.equal(keyAction(press('ArrowUp')), 'move-up');
  assert.equal(keyAction(press('ArrowDown')), 'move-down');
  assert.equal(keyAction(press('ArrowLeft')), 'move-left');
  assert.equal(keyAction(press('ArrowRight')), 'move-right');
});

test('other keys are ignored', () => {
  assert.equal(keyAction(press('a')), null);
  assert.equal(keyAction(press('Tab')), null);
});

test('a session starts empty', () => {
  const session = createKeyboardSession();
  assert.equal(session.grabbed, null);
  assert.equal(session.isGrabbed(), false);
});

test('grabbing remembers the task and its position', () => {
  const session = createKeyboardSession();
  session.grab('a', 'important-urgent', 0);
  assert.equal(session.isGrabbed(), true);
  assert.equal(session.grabbed.taskId, 'a');
  assert.equal(session.grabbed.quadrantId, 'important-urgent');
  assert.equal(session.grabbed.index, 0);
});

test('moving up and down changes the index inside the quadrant', () => {
  const session = sessionWith({ 'important-urgent': 3 });
  session.grab('a', 'important-urgent', 1);
  assert.equal(session.move('move-down').index, 2);
  assert.equal(session.move('move-up').index, 1);
  assert.equal(session.move('move-up').index, 0);
  assert.equal(session.move('move-up').index, 0, 'the index never goes below zero');
  assert.equal(session.move('move-up').quadrantId, 'important-urgent', 'the top row is the last one');
});

test('moving left and right changes the quadrant', () => {
  const session = sessionWith({});
  session.grab('a', 'important-urgent', 0);
  assert.equal(session.move('move-right').quadrantId, 'important-not-urgent');
  assert.equal(session.move('move-right').quadrantId, 'important-not-urgent', 'there is no third column');
  assert.equal(session.move('move-left').quadrantId, 'important-urgent');
  assert.equal(session.move('move-left').quadrantId, 'important-urgent');
});

test('moving down at the end of a list crosses into the row below', () => {
  const session = sessionWith({ 'important-urgent': 1, 'not-important-urgent': 2 });
  session.grab('a', 'important-urgent', 0);
  const moved = session.move('move-down');
  assert.equal(moved.quadrantId, 'not-important-urgent');
  assert.equal(moved.index, 0);
});

test('moving up at the top of a list crosses into the row above', () => {
  const session = sessionWith({ 'not-important-urgent': 2, 'important-urgent': 3 });
  session.grab('a', 'not-important-urgent', 0);
  const moved = session.move('move-up');
  assert.equal(moved.quadrantId, 'important-urgent');
  assert.equal(moved.index, 2, 'the task lands at the end of the list above');
});

test('the index is clamped to the size of the list it lands in', () => {
  const session = sessionWith({ 'important-urgent': 1, 'not-important-urgent': 0 });
  session.grab('a', 'important-urgent', 0);
  assert.equal(session.move('move-down').index, 0);
});

test('dropping returns the move and resets the session', () => {
  const session = sessionWith({});
  session.grab('a', 'important-urgent', 0);
  session.move('move-right');
  const result = session.drop();
  assert.equal(result.taskId, 'a');
  assert.equal(result.fromQuadrant, 'important-urgent');
  assert.equal(result.toQuadrant, 'important-not-urgent');
  assert.equal(session.isGrabbed(), false);
});

test('dropping without a grab returns null', () => {
  assert.equal(createKeyboardSession().drop(), null);
});

test('cancelling forgets the grabbed task', () => {
  const session = createKeyboardSession();
  session.grab('a', 'important-urgent', 0);
  assert.equal(session.cancel(), true);
  assert.equal(session.isGrabbed(), false);
  assert.equal(session.cancel(), false);
});

test('the session announces the grabbed state', () => {
  const session = createKeyboardSession();
  session.grab('a', 'important-urgent', 0);
  assert.match(session.announcement('buy milk'), /buy milk/);
  assert.match(session.announcement('buy milk'), /Do now/);
});

test('the keyboard help lists the shortcuts', () => {
  const help = KEYBOARD_HELP.map((entry) => entry.keys);
  assert.ok(help.includes('Space'));
  assert.ok(help.includes('Arrow keys'));
});

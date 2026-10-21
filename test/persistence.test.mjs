/**
 * Persistence specs: versioned storage, legacy migration and corrupt data
 * recovery.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import persistence from '../core/persistence.js';
import { createMemoryStorage, createFailingStorage } from './helpers/storage.mjs';

const {
  STORAGE_KEY,
  LEGACY_KEY,
  CURRENT_VERSION,
  save,
  load,
  migrateLegacyTasks,
  migratePayload
} = persistence;

const sampleTasks = () => [
  { id: 'a', text: 'buy milk', quadrant: 'important-urgent', completed: false, order: 0 },
  { id: 'b', text: 'call bank', quadrant: 'not-important-urgent', completed: true, order: 0 }
];

test('saves the tasks under a versioned key', () => {
  const storage = createMemoryStorage();
  save(sampleTasks(), storage);
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(raw.version, CURRENT_VERSION);
  assert.equal(raw.tasks.length, 2);
  assert.equal(raw.tasks[0].text, 'buy milk');
});

test('loads the tasks back', () => {
  const storage = createMemoryStorage();
  save(sampleTasks(), storage);
  const result = load(storage);
  assert.equal(result.tasks.length, 2);
  assert.equal(result.tasks[1].completed, true);
  assert.equal(result.migrated, false);
  assert.equal(result.recovered, false);
});

test('returns an empty list when the storage is empty', () => {
  const result = load(createMemoryStorage());
  assert.deepEqual(result.tasks, []);
  assert.equal(result.migrated, false);
});

test('migrates the legacy tasks array once', () => {
  const storage = createMemoryStorage({
    tasks: [
      { task: 'buy milk', important: true, urgent: true },
      { task: 'call bank', important: false, urgent: true },
      { task: 'walk', important: false, urgent: false }
    ]
  });
  const result = load(storage);
  assert.equal(result.tasks.length, 3);
  assert.equal(result.migrated, true);
  assert.deepEqual(result.tasks.map((t) => t.quadrant), [
    'important-urgent',
    'not-important-urgent',
    'not-important-not-urgent'
  ]);
  assert.ok(result.tasks.every((t) => t.id && t.text));
  assert.ok(storage.getItem(STORAGE_KEY), 'the versioned key holds the migrated tasks');
  assert.equal(storage.getItem(LEGACY_KEY), null, 'the legacy key is consumed once');
});

test('a failed migration leaves the original data intact', () => {
  const legacy = [{ task: 'buy milk', important: true, urgent: true }];
  const storage = createFailingStorage();
  storage.setItem = () => { throw new Error('quota exceeded'); };
  // seed the legacy payload through the raw map of the inner storage
  const inner = createMemoryStorage({ tasks: JSON.stringify(legacy) });
  const failing = createFailingStorage();
  failing.getItem = (key) => inner.getItem(key);
  const result = load(failing);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, 'buy milk');
  assert.equal(result.migrated, true);
  assert.equal(result.persisted, false);
  assert.equal(inner.getItem(LEGACY_KEY), JSON.stringify(legacy), 'the legacy payload is untouched');
});

test('recovers from corrupt data and keeps a backup of the broken payload', () => {
  const storage = createMemoryStorage({ [STORAGE_KEY]: '{not json' });
  const result = load(storage);
  assert.deepEqual(result.tasks, []);
  assert.equal(result.recovered, true);
  assert.equal(storage.getItem(`${STORAGE_KEY}.corrupt`), '{not json');
});

test('recovers from a payload with an unknown shape', () => {
  const storage = createMemoryStorage({ [STORAGE_KEY]: JSON.stringify({ version: 99, tasks: 'nope' }) });
  const result = load(storage);
  assert.deepEqual(result.tasks, []);
  assert.equal(result.recovered, true);
});

test('migrates a version 1 payload to the current version', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: 1,
      tasks: [
        { id: 'a', text: 'buy milk', quadrant: 0, done: true, position: 3 }
      ]
    })
  });
  const result = load(storage);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].quadrant, 'important-urgent');
  assert.equal(result.tasks[0].completed, true);
  assert.equal(result.tasks[0].order, 0);
  assert.equal(result.migrated, true);
});

test('drops the invalid tasks of a partially broken payload', () => {
  const storage = createMemoryStorage({
    [STORAGE_KEY]: JSON.stringify({
      version: CURRENT_VERSION,
      tasks: [
        { id: 'a', text: 'buy milk', quadrant: 'important-urgent', completed: false, order: 0 },
        { id: 'b', text: '', quadrant: 'important-urgent', completed: false, order: 1 },
        { id: 'c', text: 'ok', quadrant: 'nope', completed: false, order: 2 }
      ]
    })
  });
  const result = load(storage);
  assert.equal(result.tasks.length, 1);
  assert.equal(result.tasks[0].text, 'buy milk');
});

test('migrates the legacy tasks array as a standalone helper', () => {
  const tasks = migrateLegacyTasks([{ task: 'buy milk', important: true, urgent: false }]);
  assert.equal(tasks.length, 1);
  assert.equal(tasks[0].quadrant, 'important-not-urgent');
});

test('migrates a payload as a standalone helper', () => {
  const payload = migratePayload({ version: 1, tasks: [{ id: 'a', text: 'x', quadrant: 2, done: false, position: 0 }] });
  assert.equal(payload.version, CURRENT_VERSION);
  assert.equal(payload.tasks[0].quadrant, 'not-important-urgent');
  assert.equal(payload.tasks[0].completed, false);
});

test('a save that fails does not destroy the data already stored', () => {
  const storage = createMemoryStorage();
  save(sampleTasks(), storage);
  const failing = createFailingStorage();
  failing.getItem = (key) => storage.getItem(key);
  assert.throws(() => save(sampleTasks(), failing));
  const raw = JSON.parse(storage.getItem(STORAGE_KEY));
  assert.equal(raw.tasks.length, 2, 'the previous payload is still there');
});

test('keeps the task order after a save and load round trip', () => {
  const storage = createMemoryStorage();
  const tasks = sampleTasks();
  save(tasks, storage);
  const result = load(storage);
  assert.deepEqual(result.tasks.map((t) => t.id), ['a', 'b']);
});

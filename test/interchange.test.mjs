/**
 * JSON and CSV import/export specs.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import interchange from '../core/interchange.js';

const { exportJson, importJson, exportCsv, importCsv, detectFormat } = interchange;

const tasks = () => [
  { id: 'a', text: 'buy milk', quadrant: 'important-urgent', completed: false, order: 0 },
  { id: 'b', text: 'call the bank', quadrant: 'not-important-urgent', completed: true, order: 1 }
];

test('exports JSON with a version and the tasks', () => {
  const payload = JSON.parse(exportJson(tasks()));
  assert.equal(payload.version, 1);
  assert.equal(payload.tasks.length, 2);
  assert.equal(payload.tasks[0].text, 'buy milk');
});

test('imports JSON and restores the tasks', () => {
  const imported = importJson(exportJson(tasks()));
  assert.equal(imported.length, 2);
  assert.deepEqual(imported[0], tasks()[0]);
});

test('rejects invalid JSON', () => {
  assert.throws(() => importJson('{not json'), Error);
  assert.throws(() => importJson('{}'), Error);
});

test('exports CSV with a header row', () => {
  const csv = exportCsv(tasks());
  const lines = csv.trim().split('\r\n');
  assert.equal(lines[0], 'id,text,quadrant,completed,order');
  assert.equal(lines[1], 'a,buy milk,important-urgent,false,0');
});

test('quotes the CSV fields that need it', () => {
  const csv = exportCsv([{ id: 'a', text: 'buy, milk', quadrant: 'important-urgent', completed: false, order: 0 }]);
  assert.match(csv, /"buy, milk"/);
});

test('round trips text with commas, quotes and newlines', () => {
  const tricky = [
    { id: 'a', text: 'buy, milk', quadrant: 'important-urgent', completed: false, order: 0 },
    { id: 'b', text: 'say "hello"', quadrant: 'important-urgent', completed: false, order: 1 },
    { id: 'c', text: 'two\nlines', quadrant: 'important-urgent', completed: false, order: 2 },
    { id: 'd', text: 'mixed, "quotes"\ninside', quadrant: 'important-urgent', completed: false, order: 3 }
  ];
  const imported = importCsv(exportCsv(tricky));
  assert.equal(imported.length, 4);
  assert.deepEqual(imported.map((t) => t.text), tricky.map((t) => t.text));
});

test('imports a CSV without a header row', () => {
  const csv = 'a,buy milk,important-urgent,false,0';
  const imported = importCsv(csv);
  assert.equal(imported.length, 1);
  assert.equal(imported[0].text, 'buy milk');
});

test('imports a CSV with a header row', () => {
  const imported = importCsv(exportCsv(tasks()));
  assert.deepEqual(imported.map((t) => t.id), ['a', 'b']);
});

test('ignores the blank lines of a CSV', () => {
  const csv = 'id,text,quadrant,completed,order\r\n\r\na,buy milk,important-urgent,false,0\r\n';
  const imported = importCsv(csv);
  assert.equal(imported.length, 1);
});

test('detects the format of a payload', () => {
  assert.equal(detectFormat('{"version":1,"tasks":[]}'), 'json');
  assert.equal(detectFormat('id,text,quadrant,completed,order'), 'csv');
});

test('imports an empty CSV into an empty list', () => {
  assert.deepEqual(importCsv(''), []);
});

test('imports an empty JSON task list', () => {
  assert.deepEqual(importJson(JSON.stringify({ version: 1, tasks: [] })), []);
});

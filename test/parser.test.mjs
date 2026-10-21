/**
 * Paste parser specs.
 *
 * The parser turns a blob of pasted text into a list of task previews. Each
 * preview carries the text, the target quadrant and the completion flag.
 */
import test from 'node:test';
import assert from 'node:assert/strict';

import parser from '../core/parser.js';

const { parsePaste, normaliseLine } = parser;

const texts = (input, options) => parsePaste(input, options).map((item) => item.text);

test('rejects non-string input', () => {
  assert.throws(() => parsePaste(null), TypeError);
  assert.throws(() => parsePaste(42), TypeError);
  assert.throws(() => parsePaste(undefined), TypeError);
  assert.throws(() => parsePaste({ text: 'nope' }), TypeError);
});

test('returns an empty list for empty or whitespace-only input', () => {
  assert.deepEqual(parsePaste(''), []);
  assert.deepEqual(parsePaste('   \n\t\n  '), []);
});

test('strips bullet prefixes', () => {
  assert.deepEqual(texts('- buy milk'), ['buy milk']);
  assert.deepEqual(texts('* buy milk'), ['buy milk']);
  assert.deepEqual(texts('+ buy milk'), ['buy milk']);
  assert.deepEqual(texts('• buy milk'), ['buy milk']);
  assert.deepEqual(texts('-   buy milk'), ['buy milk']);
  assert.deepEqual(texts('  - buy milk'), ['buy milk']);
});

test('strips ordered numbering prefixes', () => {
  assert.deepEqual(texts('1. buy milk'), ['buy milk']);
  assert.deepEqual(texts('1) buy milk'), ['buy milk']);
  assert.deepEqual(texts('1/ buy milk'), ['buy milk']);
  assert.deepEqual(texts('12. buy milk'), ['buy milk']);
  assert.deepEqual(texts('3.3 buy milk'), ['buy milk']);
  assert.deepEqual(texts('2024. buy milk'), ['buy milk']);
});

test('keeps numbers that are part of the task text', () => {
  assert.deepEqual(texts('pay 42 euros'), ['pay 42 euros']);
  assert.deepEqual(texts('renew passport 2027'), ['renew passport 2027']);
});

test('strips checkbox markers and records the completion flag', () => {
  const items = parsePaste('- [ ] write report\n- [x] call the bank');
  assert.deepEqual(items.map((i) => i.text), ['write report', 'call the bank']);
  assert.deepEqual(items.map((i) => i.completed), [false, true]);
});

test('strips markdown headings', () => {
  assert.deepEqual(texts('# Heading'), ['Heading']);
  assert.deepEqual(texts('### Deep heading'), ['Deep heading']);
  assert.deepEqual(texts('###### Level six'), ['Level six']);
});

test('strips markdown emphasis', () => {
  assert.deepEqual(texts('**bold**'), ['bold']);
  assert.deepEqual(texts('*italic*'), ['italic']);
  assert.deepEqual(texts('_italic_'), ['italic']);
  assert.deepEqual(texts('__bold__'), ['bold']);
  assert.deepEqual(texts('~~struck~~'), ['struck']);
  assert.deepEqual(texts('`code`'), ['code']);
});

test('keeps inner emphasis markers that are not wrapping the whole line', () => {
  assert.deepEqual(texts('snake_case name'), ['snake_case name']);
  assert.deepEqual(texts('2 * 3 = 6'), ['2 * 3 = 6']);
});

test('trims leading and trailing whitespace', () => {
  assert.deepEqual(texts('   buy milk   '), ['buy milk']);
  assert.deepEqual(texts('\tbuy milk\t'), ['buy milk']);
  assert.deepEqual(normaliseLine('   buy milk   '), 'buy milk');
});

test('skips blank lines and keeps the order of the rest', () => {
  assert.deepEqual(texts('one\n\n\ntwo\n   \nthree'), ['one', 'two', 'three']);
});

test('drops case-insensitive duplicates and keeps the first occurrence', () => {
  assert.deepEqual(texts('Buy milk\nbuy milk\nBUY MILK'), ['Buy milk']);
  assert.deepEqual(texts('Buy milk\nbuy  milk'), ['Buy milk']);
});

test('handles carriage returns', () => {
  assert.deepEqual(texts('one\r\ntwo\r\n'), ['one', 'two']);
});

test('every parsed line gets the default quadrant', () => {
  const items = parsePaste('one\ntwo', { defaultQuadrant: 'important-urgent' });
  assert.deepEqual(items.map((i) => i.quadrant), ['important-urgent', 'important-urgent']);
});

test('a quadrant resolver can pick the quadrant per line', () => {
  const items = parsePaste('one\ntwo', {
    defaultQuadrant: 'not-important-not-urgent',
    quadrantResolver: (line, index) => (index === 0 ? 'important-urgent' : 'not-important-urgent')
  });
  assert.deepEqual(items.map((i) => i.quadrant), ['important-urgent', 'not-important-urgent']);
});

test('an invalid resolved quadrant falls back to the default quadrant', () => {
  const items = parsePaste('one', {
    defaultQuadrant: 'not-important-urgent',
    quadrantResolver: () => 'nope'
  });
  assert.equal(items[0].quadrant, 'not-important-urgent');
});

test('an invalid default quadrant falls back to the eliminate quadrant', () => {
  const items = parsePaste('one', { defaultQuadrant: 'nope' });
  assert.equal(items[0].quadrant, 'not-important-not-urgent');
});

test('handles a 500 line paste in linear time', () => {
  const lines = [];
  for (let i = 0; i < 500; i++) lines.push(`- task ${i}`);
  const started = Date.now();
  const items = parsePaste(lines.join('\n'));
  const elapsed = Date.now() - started;
  assert.equal(items.length, 500);
  assert.equal(items[499].text, 'task 499');
  assert.ok(elapsed < 1000, `parse took ${elapsed}ms`);
});

test('handles a very long single line', () => {
  const long = 'x'.repeat(100000);
  const items = parsePaste(long);
  assert.equal(items.length, 1);
  assert.equal(items[0].text.length, 100000);
});

test('keeps the source line index for every preview', () => {
  const items = parsePaste('- one\n\n- two');
  assert.deepEqual(items.map((i) => i.line), [0, 2]);
});

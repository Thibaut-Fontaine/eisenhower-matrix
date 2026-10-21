/**
 * Paste parser.
 *
 * Turns a blob of pasted text into a list of previews. The parser removes the
 * noise that comes with copied lists (bullet and numbering markers, checkbox
 * markers, markdown headings and emphasis, surrounding whitespace) and drops
 * the lines that are empty or that repeat an earlier line.
 *
 * The parser is pure: it never touches the DOM and never writes to storage.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'parser', function (root) {
  'use strict';

  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  var DEFAULT_QUADRANT = 'not-important-not-urgent';

  var HEADING = /^#{1,6}\s+/;
  var BLOCKQUOTE = /^>\s?/;
  var CHECKBOX = /^\[([ xX✓])\]\s*/;
  var BULLET = /^[-*+•▪‣·]\s+/;
  // "1. ", "1) ", "1/ " and the nested "1.2.3 " forms.
  var ORDERED = /^(?:\d+[.)\/:]\s+|\d+(?:[.)\/]\d+)+\s+)/;

  var EMPHASIS_PAIRS = [['**', '**'], ['__', '__'], ['~~', '~~'], ['*', '*'], ['_', '_'], ['`', '`']];

  function stripEmphasis(text) {
    var out = text;
    var changed = true;
    while (changed) {
      changed = false;
      for (var i = 0; i < EMPHASIS_PAIRS.length; i++) {
        var open = EMPHASIS_PAIRS[i][0];
        var close = EMPHASIS_PAIRS[i][1];
        if (out.length >= open.length + close.length &&
            out.indexOf(open) === 0 &&
            out.lastIndexOf(close) === out.length - close.length) {
          out = out.slice(open.length, out.length - close.length).trim();
          changed = true;
        }
      }
    }
    return out.replace(/\*\*([^*]+)\*\*/g, '$1').replace(/~~([^~]+)~~/g, '$1');
  }

  /**
   * Normalise one pasted line. Returns null when the line holds no task.
   *
   * `normaliseLine` returns the cleaned text; `parseLine` returns the text
   * together with the completion flag of a checkbox marker.
   */
  function parseLine(line) {
    if (typeof line !== 'string') return null;
    var text = line.trim();
    if (text === '') return null;

    text = text.replace(HEADING, '').trim();
    text = text.replace(BLOCKQUOTE, '').trim();

    // A checkbox marker may sit before or after the list marker.
    var checked = false;
    var checkbox = text.match(CHECKBOX);
    if (checkbox) {
      checked = checkbox[1].toLowerCase() === 'x' || checkbox[1] === '✓';
      text = text.slice(checkbox[0].length).trim();
    }

    text = text.replace(BULLET, '').trim();
    text = text.replace(ORDERED, '').trim();

    var inner = text.match(CHECKBOX);
    if (inner) {
      checked = inner[1].toLowerCase() === 'x' || inner[1] === '✓';
      text = text.slice(inner[0].length).trim();
    }

    text = stripEmphasis(text).trim();
    if (text === '') return null;
    return { text: text, completed: checked };
  }

  function normaliseLine(line) {
    var parsed = parseLine(line);
    return parsed === null ? null : parsed.text;
  }

  function dedupeKey(text) {
    return text.replace(/\s+/g, ' ').trim().toLowerCase();
  }

  /**
   * Parse a pasted blob.
   *
   * options.defaultQuadrant   quadrant used for the lines without a resolver
   * options.quadrantResolver   (line, index) => quadrant id
   *
   * Returns an array of previews: { text, quadrant, completed, line }.
   */
  function parsePaste(input, options) {
    if (typeof input !== 'string') {
      throw new TypeError('parsePaste expects a string');
    }
    var opts = options || {};
    var defaultQuadrant = quadrants.isQuadrantId(opts.defaultQuadrant)
      ? opts.defaultQuadrant
      : DEFAULT_QUADRANT;
    var resolver = typeof opts.quadrantResolver === 'function' ? opts.quadrantResolver : null;

    var lines = input.split(/\r\n|\r|\n/);
    var items = [];
    var seen = Object.create(null);

    for (var i = 0; i < lines.length; i++) {
      var normalised = parseLine(lines[i]);
      if (normalised === null) continue;

      var key = dedupeKey(normalised.text);
      if (seen[key]) continue;
      seen[key] = true;

      var quadrant = defaultQuadrant;
      if (resolver) {
        var resolved = resolver(lines[i], i);
        if (quadrants.isQuadrantId(resolved)) quadrant = resolved;
      }

      items.push({
        text: normalised.text,
        quadrant: quadrant,
        completed: normalised.completed,
        line: i
      });
    }

    return items;
  }

  return {
    parsePaste: parsePaste,
    normaliseLine: normaliseLine,
    parseLine: parseLine,
    DEFAULT_QUADRANT: DEFAULT_QUADRANT
  };
});

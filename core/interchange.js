/**
 * Import and export.
 *
 * The JSON payload is the full backup format. The CSV payload is meant for
 * spreadsheets and follows RFC 4180: the fields that hold a comma, a quote
 * or a newline are quoted and the quotes are doubled.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'interchange', function (root) {
  'use strict';

  var taskModel = (typeof require === 'function')
    ? require('./task.js')
    : root.Eisenhower.task;

  var CSV_HEADER = ['id', 'text', 'quadrant', 'completed', 'order'];
  var JSON_VERSION = 1;

  function exportJson(tasks) {
    var payload = {
      version: JSON_VERSION,
      exportedAt: new Date().toISOString(),
      tasks: Array.isArray(tasks) ? tasks : []
    };
    return JSON.stringify(payload, null, 2);
  }

  function importJson(text) {
    var payload;
    try {
      payload = JSON.parse(text);
    } catch (error) {
      throw new Error('the file is not valid JSON');
    }
    var list = null;
    if (Array.isArray(payload)) list = payload;
    else if (payload && Array.isArray(payload.tasks)) list = payload.tasks;
    if (!list) throw new Error('the file does not hold a task list');
    var out = [];
    for (var i = 0; i < list.length; i++) {
      var normalised = taskModel.normaliseTask(list[i]);
      if (normalised) out.push(normalised);
    }
    return out;
  }

  function csvEscape(value) {
    var text = value === null || value === undefined ? '' : String(value);
    if (/[",\r\n]/.test(text)) {
      return '"' + text.replace(/"/g, '""') + '"';
    }
    return text;
  }

  function exportCsv(tasks) {
    var rows = [CSV_HEADER.join(',')];
    var list = Array.isArray(tasks) ? tasks : [];
    for (var i = 0; i < list.length; i++) {
      var task = list[i];
      rows.push([
        csvEscape(task.id),
        csvEscape(task.text),
        csvEscape(task.quadrant),
        csvEscape(task.completed ? 'true' : 'false'),
        csvEscape(task.order)
      ].join(','));
    }
    return rows.join('\r\n') + '\r\n';
  }

  /**
   * Split a CSV payload into rows of raw cells.
   */
  function parseCsvRows(text) {
    var rows = [];
    var row = [];
    var cell = '';
    var inQuotes = false;
    var i = 0;
    var source = String(text);

    while (i < source.length) {
      var char = source[i];
      if (inQuotes) {
        if (char === '"') {
          if (source[i + 1] === '"') {
            cell += '"';
            i += 2;
            continue;
          }
          inQuotes = false;
          i += 1;
          continue;
        }
        cell += char;
        i += 1;
        continue;
      }
      if (char === '"') {
        inQuotes = true;
        i += 1;
        continue;
      }
      if (char === ',') {
        row.push(cell);
        cell = '';
        i += 1;
        continue;
      }
      if (char === '\r' || char === '\n') {
        if (char === '\r' && source[i + 1] === '\n') i += 1;
        row.push(cell);
        rows.push(row);
        row = [];
        cell = '';
        i += 1;
        continue;
      }
      cell += char;
      i += 1;
    }
    if (cell !== '' || row.length > 0) {
      row.push(cell);
      rows.push(row);
    }
    return rows;
  }

  function importCsv(text) {
    var rows = parseCsvRows(text === null || text === undefined ? '' : String(text));
    var out = [];
    var start = 0;
    if (rows.length > 0) {
      var first = rows[0].map(function (cell) { return String(cell).trim().toLowerCase(); });
      if (first.length === CSV_HEADER.length && first[0] === CSV_HEADER[0] && first[1] === CSV_HEADER[1]) {
        start = 1;
      }
    }
    for (var i = start; i < rows.length; i++) {
      var row = rows[i];
      if (row.length === 1 && String(row[0]).trim() === '') continue;
      if (row.length < 2) continue;
      var text_ = String(row[1] === undefined ? '' : row[1]);
      if (text_.trim() === '') continue;
      var quadrant = row[2] === undefined ? 'not-important-not-urgent' : String(row[2]).trim();
      var completed = String(row[3] === undefined ? 'false' : row[3]).trim().toLowerCase();
      var order = Number(row[4]);
      var task = {
        id: row[0] === undefined || String(row[0]).trim() === '' ? undefined : String(row[0]),
        text: text_.trim(),
        quadrant: quadrant,
        completed: completed === 'true' || completed === '1' || completed === 'yes',
        order: isFinite(order) ? order : out.length
      };
      var normalised = taskModel.normaliseTask(task);
      if (normalised) out.push(normalised);
    }
    return out;
  }

  function detectFormat(text) {
    var trimmed = String(text === null || text === undefined ? '' : text).trim();
    if (trimmed.charAt(0) === '{' || trimmed.charAt(0) === '[') return 'json';
    return 'csv';
  }

  return {
    CSV_HEADER: CSV_HEADER,
    exportJson: exportJson,
    importJson: importJson,
    exportCsv: exportCsv,
    importCsv: importCsv,
    detectFormat: detectFormat
  };
});

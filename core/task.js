/**
 * The task model shared by the extension and the standalone web app.
 *
 * A task is a plain object with five fields:
 *   id        unique string identifier
 *   text      the user text, trimmed and never empty
 *   quadrant  one of the four Eisenhower quadrant ids
 *   completed boolean completion flag
 *   order     number, the position of the task inside its quadrant
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'task', function (root) {
  'use strict';

  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  var idCounter = 0;

  function defaultIdFactory() {
    idCounter += 1;
    var random = Math.random().toString(36).slice(2, 8);
    return 't-' + Date.now().toString(36) + '-' + idCounter.toString(36) + '-' + random;
  }

  function normaliseText(value) {
    if (typeof value !== 'string') {
      throw new TypeError('task text must be a string');
    }
    var text = value.trim();
    if (text === '') {
      throw new TypeError('task text must not be empty');
    }
    return text;
  }

  function normaliseQuadrant(value) {
    if (!quadrants.isQuadrantId(value)) {
      throw new TypeError('unknown quadrant: ' + String(value));
    }
    return value;
  }

  function normaliseOrder(value) {
    var order = Number(value);
    if (!isFinite(order) || order < 0) return 0;
    return Math.floor(order);
  }

  /**
   * Build a task from a partial description. Throws a TypeError when a field
   * is invalid so that a bad value never reaches the store.
   */
  function createTask(input, idFactory) {
    var source = input || {};
    var factory = idFactory || defaultIdFactory;
    var id = source.id;
    if (typeof id !== 'string' || id.trim() === '') id = factory();
    return {
      id: id,
      text: normaliseText(source.text),
      quadrant: normaliseQuadrant(source.quadrant),
      completed: source.completed === true,
      order: normaliseOrder(source.order)
    };
  }

  /**
   * Lenient version used when reading data back from storage: an invalid
   * task returns null instead of throwing.
   */
  function normaliseTask(input) {
    try {
      return createTask(input);
    } catch (error) {
      return null;
    }
  }

  function isTask(value) {
    return !!value && typeof value === 'object' && typeof value.id === 'string' &&
      typeof value.text === 'string' && typeof value.quadrant === 'string' &&
      typeof value.completed === 'boolean' && typeof value.order === 'number';
  }

  return {
    createTask: createTask,
    normaliseTask: normaliseTask,
    normaliseText: normaliseText,
    defaultIdFactory: defaultIdFactory
  };
});

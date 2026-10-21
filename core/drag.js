/**
 * Drag and drop.
 *
 * The module holds the state of a drag and the pointer geometry helpers.
 * It knows nothing about the DOM: the application controller feeds it the
 * rectangles it measures and it gives back the quadrant and the index where
 * the task must be dropped.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'drag', function (root) {
  'use strict';

  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  function createDragState() {
    return {
      active: false,
      taskId: null,
      fromQuadrant: null,
      toQuadrant: null,
      index: 0,
      pointerId: null
    };
  }

  function beginDrag(state, options) {
    var opts = options || {};
    state.active = true;
    state.taskId = opts.taskId === undefined ? null : opts.taskId;
    state.fromQuadrant = quadrants.isQuadrantId(opts.quadrantId) ? opts.quadrantId : null;
    state.toQuadrant = state.fromQuadrant;
    state.index = typeof opts.index === 'number' && isFinite(opts.index) ? Math.floor(opts.index) : 0;
    state.pointerId = opts.pointerId === undefined ? null : opts.pointerId;
    return state;
  }

  function updateDrag(state, options) {
    var opts = options || {};
    if (!state.active) return state;
    if (quadrants.isQuadrantId(opts.quadrantId)) state.toQuadrant = opts.quadrantId;
    if (typeof opts.index === 'number' && isFinite(opts.index)) {
      state.index = Math.max(0, Math.floor(opts.index));
    }
    return state;
  }

  function reset(state) {
    state.active = false;
    state.taskId = null;
    state.fromQuadrant = null;
    state.toQuadrant = null;
    state.index = 0;
    state.pointerId = null;
    return state;
  }

  function cancelDrag(state) {
    return reset(state);
  }

  /**
   * Finish the drag and return the move it describes, or null when no drag
   * was running.
   */
  function endDrag(state) {
    if (!state.active) return null;
    var result = {
      taskId: state.taskId,
      fromQuadrant: state.fromQuadrant,
      toQuadrant: state.toQuadrant === null ? state.fromQuadrant : state.toQuadrant,
      index: state.index
    };
    reset(state);
    return result;
  }

  /**
   * The sentence read by the screen reader while a task is dragged.
   */
  function dragAnnouncement(state, text) {
    if (!state.active) return '';
    var label = quadrants.getQuadrant(state.toQuadrant);
    var name = label ? label.label : 'the matrix';
    var task = text ? '“' + text + '”' : 'The task';
    return task + ' is over ' + name + '. Press space to drop, escape to cancel.';
  }

  /**
   * The quadrant whose rectangle holds the point, or null.
   */
  function hitQuadrant(rects, point) {
    var list = Array.isArray(rects) ? rects : [];
    for (var i = 0; i < list.length; i++) {
      var rect = list[i];
      if (!rect) continue;
      var x = point.x;
      var y = point.y;
      if (x >= rect.x && x <= rect.x + rect.width && y >= rect.y && y <= rect.y + rect.height) {
        return rect.id;
      }
    }
    return null;
  }

  /**
   * The index at which a task dropped at the point must be inserted: the
   * number of tasks whose middle sits above the point.
   */
  function insertionIndex(taskRects, point) {
    var list = Array.isArray(taskRects) ? taskRects : [];
    var index = 0;
    for (var i = 0; i < list.length; i++) {
      var rect = list[i];
      if (!rect) continue;
      var middle = rect.y + rect.height / 2;
      if (point.y < middle) break;
      index += 1;
    }
    return index;
  }

  return {
    createDragState: createDragState,
    beginDrag: beginDrag,
    updateDrag: updateDrag,
    endDrag: endDrag,
    cancelDrag: cancelDrag,
    dragAnnouncement: dragAnnouncement,
    hitQuadrant: hitQuadrant,
    insertionIndex: insertionIndex
  };
});

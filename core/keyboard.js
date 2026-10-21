/**
 * The keyboard flow.
 *
 * A task can be picked up with the space bar, moved with the arrow keys and
 * dropped with the space bar. The escape key cancels. The module is pure: it
 * keeps the state of the session and produces the sentences that the
 * application reads to the screen reader.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'keyboard', function (root) {
  'use strict';

  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  var KEYBOARD_HELP = [
    { keys: 'Tab', action: 'Move the focus to the next task' },
    { keys: 'Space', action: 'Pick a task up, or drop the task you carry' },
    { keys: 'Enter', action: 'Pick a task up, or drop the task you carry' },
    { keys: 'Arrow keys', action: 'Move the task you carry' },
    { keys: 'Escape', action: 'Cancel the move' },
    { keys: 'Delete', action: 'Delete the task' }
  ];

  /**
   * The action a key press asks for, or null when the key is not part of the
   * flow.
   */
  function keyAction(event) {
    if (!event || typeof event.key !== 'string') return null;
    if (event.ctrlKey || event.metaKey || event.altKey) return null;
    var key = event.key;
    if (key === ' ' || key === 'Spacebar' || key === 'Space' || key === 'Enter') return 'grab';
    if (key === 'Escape' || key === 'Esc') return 'cancel';
    if (key === 'ArrowUp') return 'move-up';
    if (key === 'ArrowDown') return 'move-down';
    if (key === 'ArrowLeft') return 'move-left';
    if (key === 'ArrowRight') return 'move-right';
    return null;
  }

  function createKeyboardSession(options) {
    var opts = options || {};
    var listSize = typeof opts.listSize === 'function'
      ? opts.listSize
      : function () { return Infinity; };

    var session = {
      grabbed: null
    };

    session.isGrabbed = function () {
      return session.grabbed !== null;
    };

    session.grab = function (taskId, quadrantId, index) {
      session.grabbed = {
        taskId: taskId,
        fromQuadrant: quadrants.isQuadrantId(quadrantId) ? quadrantId : null,
        quadrantId: quadrants.isQuadrantId(quadrantId) ? quadrantId : null,
        index: typeof index === 'number' && isFinite(index) ? Math.max(0, Math.floor(index)) : 0
      };
      return session.grabbed;
    };

    /**
     * Move the carried task. Returns the new position, or null when no task
     * is carried.
     *
     * The vertical keys move the task inside its list; at the end of the list
     * the task crosses into the row below (or above). The horizontal keys
     * cross the columns.
     */
    session.move = function (direction) {
      if (!session.grabbed) return null;
      var current = session.grabbed;

      if (direction === 'move-up' || direction === 'move-down') {
        var delta = direction === 'move-up' ? -1 : 1;
        var size = listSize(current.quadrantId);
        var next = current.index + delta;

        if (next < 0) {
          var above = quadrants.neighbour(current.quadrantId, 'up');
          if (above && above !== current.quadrantId) {
            current.quadrantId = above;
            current.index = Math.max(0, listSize(above) - 1);
          } else {
            current.index = 0;
          }
          return { quadrantId: current.quadrantId, index: current.index };
        }

        if (isFinite(size) && next > size - 1) {
          var below = quadrants.neighbour(current.quadrantId, 'down');
          if (below && below !== current.quadrantId) {
            current.quadrantId = below;
            current.index = Math.min(current.index, Math.max(0, listSize(below) - 1));
          } else {
            current.index = Math.max(0, size - 1);
          }
          return { quadrantId: current.quadrantId, index: current.index };
        }

        current.index = next;
        return { quadrantId: current.quadrantId, index: current.index };
      }

      if (direction === 'move-left' || direction === 'move-right') {
        var side = direction === 'move-left' ? 'left' : 'right';
        var neighbour = quadrants.neighbour(current.quadrantId, side);
        if (neighbour && neighbour !== current.quadrantId) {
          current.quadrantId = neighbour;
          var targetSize = listSize(neighbour);
          if (isFinite(targetSize) && current.index > targetSize - 1) {
            current.index = Math.max(0, targetSize - 1);
          }
        }
        return { quadrantId: current.quadrantId, index: current.index };
      }

      return { quadrantId: current.quadrantId, index: current.index };
    };

    /**
     * Drop the carried task and return the move it describes.
     */
    session.drop = function () {
      if (!session.grabbed) return null;
      var result = {
        taskId: session.grabbed.taskId,
        fromQuadrant: session.grabbed.fromQuadrant,
        toQuadrant: session.grabbed.quadrantId,
        index: session.grabbed.index
      };
      session.grabbed = null;
      return result;
    };

    session.cancel = function () {
      if (!session.grabbed) return false;
      session.grabbed = null;
      return true;
    };

    /**
     * The sentence read by the screen reader.
     */
    session.announcement = function (text) {
      if (!session.grabbed) return '';
      var label = quadrants.getQuadrant(session.grabbed.quadrantId);
      var name = label ? label.label : 'the matrix';
      var task = text ? '“' + text + '”' : 'The task';
      return task + ' is carried over ' + name + '. Press space to drop, escape to cancel.';
    };

    return session;
  }

  return {
    KEYBOARD_HELP: KEYBOARD_HELP,
    keyAction: keyAction,
    createKeyboardSession: createKeyboardSession
  };
});

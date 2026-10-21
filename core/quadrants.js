;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'quadrants', function () {
  'use strict';

  var QUADRANTS = [
    { id: 'important-urgent', label: 'Do now', description: 'Important and urgent', important: true, urgent: true, color: '#c62828', row: 0, col: 0 },
    { id: 'important-not-urgent', label: 'Schedule', description: 'Important, not urgent', important: true, urgent: false, color: '#1565c0', row: 0, col: 1 },
    { id: 'not-important-urgent', label: 'Delegate', description: 'Not important, urgent', important: false, urgent: true, color: '#ef6c00', row: 1, col: 0 },
    { id: 'not-important-not-urgent', label: 'Eliminate', description: 'Neither important nor urgent', important: false, urgent: false, color: '#2e7d32', row: 1, col: 1 }
  ];

  function quadrantIds() {
    return QUADRANTS.map(function (q) { return q.id; });
  }

  function getQuadrant(id) {
    for (var i = 0; i < QUADRANTS.length; i++) if (QUADRANTS[i].id === id) return QUADRANTS[i];
    return null;
  }

  function isQuadrantId(id) {
    return getQuadrant(id) !== null;
  }

  function quadrantIdFor(important, urgent) {
    return important
      ? (urgent ? 'important-urgent' : 'important-not-urgent')
      : (urgent ? 'not-important-urgent' : 'not-important-not-urgent');
  }

  /**
   * The quadrant next to the given one in the grid.
   *
   * The matrix has two columns: urgent on the left, not urgent on the right;
   * and two rows: important on top, not important at the bottom. "left" and
   * "right" therefore cross the columns, "up" and "down" cross the rows.
   */
  function neighbour(quadrantId, direction) {
    var current = getQuadrant(quadrantId);
    if (!current) return null;
    var row = current.row;
    var col = current.col;
    if (direction === 'left') col -= 1;
    else if (direction === 'right') col += 1;
    else if (direction === 'up') row -= 1;
    else if (direction === 'down') row += 1;
    else return null;
    if (row < 0 || row > 1 || col < 0 || col > 1) return current.id;
    for (var i = 0; i < QUADRANTS.length; i++) {
      if (QUADRANTS[i].row === row && QUADRANTS[i].col === col) return QUADRANTS[i].id;
    }
    return current.id;
  }

  return {
    QUADRANTS: QUADRANTS,
    quadrantIds: quadrantIds,
    getQuadrant: getQuadrant,
    isQuadrantId: isQuadrantId,
    quadrantIdFor: quadrantIdFor,
    neighbour: neighbour
  };
});

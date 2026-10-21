;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'quadrants', function () {
  'use strict';

  var QUADRANTS = [
    { id: 'important-urgent', label: 'Do now', description: 'Important and urgent', important: true, urgent: true, color: '#c62828' },
    { id: 'important-not-urgent', label: 'Schedule', description: 'Important, not urgent', important: true, urgent: false, color: '#1565c0' },
    { id: 'not-important-urgent', label: 'Delegate', description: 'Not important, urgent', important: false, urgent: true, color: '#ef6c00' },
    { id: 'not-important-not-urgent', label: 'Eliminate', description: 'Neither important nor urgent', important: false, urgent: false, color: '#2e7d32' }
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

  return {
    QUADRANTS: QUADRANTS,
    quadrantIds: quadrantIds,
    getQuadrant: getQuadrant,
    isQuadrantId: isQuadrantId,
    quadrantIdFor: quadrantIdFor
  };
});

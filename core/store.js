/**
 * The task store.
 *
 * The store owns the tasks of one matrix: it adds, edits, deletes, completes,
 * moves and reorders them, and it keeps a contiguous order inside every
 * quadrant. It knows nothing about the DOM and nothing about storage; the
 * persistence layer reads from and writes to it.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'store', function (root) {
  'use strict';

  var taskModel = (typeof require === 'function')
    ? require('./task.js')
    : root.Eisenhower.task;
  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  function TaskStore(options) {
    var opts = options || {};
    this._tasks = [];
    this._sequence = 0;
    this._listeners = [];
    this._idFactory = opts.idFactory || taskModel.defaultIdFactory;
    if (Array.isArray(opts.tasks)) {
      for (var i = 0; i < opts.tasks.length; i++) {
        var normalised = taskModel.normaliseTask(opts.tasks[i]);
        if (normalised) this._insert(normalised);
      }
    }
  }

  TaskStore.prototype._insert = function (task) {
    this._sequence += 1;
    // The sequence number is an internal tie breaker: it must never show up
    // in the serialised tasks.
    Object.defineProperty(task, 'seq', {
      value: this._sequence,
      enumerable: false,
      writable: true,
      configurable: true
    });
    this._tasks.push(task);
    return task;
  };

  TaskStore.prototype._notify = function () {
    for (var i = 0; i < this._listeners.length; i++) this._listeners[i](this);
  };

  TaskStore.prototype.subscribe = function (listener) {
    if (typeof listener !== 'function') return function () {};
    this._listeners.push(listener);
    var self = this;
    return function () {
      var index = self._listeners.indexOf(listener);
      if (index !== -1) self._listeners.splice(index, 1);
    };
  };

  TaskStore.prototype._sortByOrder = function (a, b) {
    if (a.order !== b.order) return a.order - b.order;
    return a.seq - b.seq;
  };

  TaskStore.prototype._ofQuadrant = function (quadrantId, completed) {
    var out = [];
    for (var i = 0; i < this._tasks.length; i++) {
      var task = this._tasks[i];
      if (task.quadrant !== quadrantId) continue;
      if (completed !== undefined && task.completed !== completed) continue;
      out.push(task);
    }
    out.sort(this._sortByOrder.bind(this));
    return out;
  };

  /**
   * Give every task of a quadrant a contiguous order: the active tasks first,
   * then the completed ones.
   */
  TaskStore.prototype._reindex = function (quadrantId) {
    var active = this._ofQuadrant(quadrantId, false);
    var done = this._ofQuadrant(quadrantId, true);
    for (var i = 0; i < active.length; i++) active[i].order = i;
    for (var j = 0; j < done.length; j++) done[j].order = active.length + j;
  };

  TaskStore.prototype._find = function (id) {
    for (var i = 0; i < this._tasks.length; i++) {
      if (this._tasks[i].id === id) return this._tasks[i];
    }
    return null;
  };

  TaskStore.prototype._require = function (id) {
    var found = this._find(id);
    if (!found) throw new TypeError('unknown task: ' + String(id));
    return found;
  };

  TaskStore.prototype.add = function (input, options) {
    var descriptor;
    if (input && typeof input === 'object') {
      descriptor = { text: input.text, quadrant: input.quadrant, completed: input.completed };
    } else {
      var opts = options || {};
      descriptor = { text: input, quadrant: opts.quadrant, completed: opts.completed };
    }
    if (descriptor.quadrant === undefined || descriptor.quadrant === null) {
      descriptor.quadrant = quadrants.quadrantIds()[3];
    }
    var task = taskModel.createTask(descriptor, this._idFactory);
    var siblings = this._ofQuadrant(task.quadrant);
    task.order = siblings.length;
    this._insert(task);
    this._reindex(task.quadrant);
    this._notify();
    return task;
  };

  TaskStore.prototype.addMany = function (items) {
    var added = [];
    var list = Array.isArray(items) ? items : [];
    for (var i = 0; i < list.length; i++) {
      var item = list[i];
      if (item && typeof item === 'object') {
        added.push(this.add(item));
      } else if (typeof item === 'string') {
        added.push(this.add(item));
      }
    }
    return added;
  };

  TaskStore.prototype.get = function (id) {
    var found = this._find(id);
    return found || null;
  };

  TaskStore.prototype.all = function () {
    var out = this._tasks.slice();
    out.sort(function (a, b) {
      var indexA = quadrants.quadrantIds().indexOf(a.quadrant);
      var indexB = quadrants.quadrantIds().indexOf(b.quadrant);
      if (indexA !== indexB) return indexA - indexB;
      return a.order - b.order;
    });
    return out;
  };

  TaskStore.prototype.list = function (quadrantId) {
    if (!quadrants.isQuadrantId(quadrantId)) throw new TypeError('unknown quadrant: ' + String(quadrantId));
    return this._ofQuadrant(quadrantId, false);
  };

  TaskStore.prototype.completedList = function (quadrantId) {
    if (!quadrants.isQuadrantId(quadrantId)) throw new TypeError('unknown quadrant: ' + String(quadrantId));
    return this._ofQuadrant(quadrantId, true);
  };

  TaskStore.prototype.update = function (id, patch) {
    var task = this._require(id);
    var changes = patch || {};
    if (changes.text !== undefined) task.text = taskModel.normaliseText(changes.text);
    if (changes.quadrant !== undefined) {
      var quadrant = changes.quadrant;
      if (!quadrants.isQuadrantId(quadrant)) throw new TypeError('unknown quadrant: ' + String(quadrant));
      if (quadrant !== task.quadrant) {
        task.quadrant = quadrant;
        task.order = this._ofQuadrant(quadrant).length;
        this._reindex(quadrant);
      }
    }
    if (changes.completed !== undefined) task.completed = changes.completed === true;
    this._reindex(task.quadrant);
    this._notify();
    return task;
  };

  TaskStore.prototype.setCompleted = function (id, completed) {
    return this.update(id, { completed: completed === true });
  };

  TaskStore.prototype.toggleComplete = function (id) {
    var task = this._require(id);
    return this.update(id, { completed: !task.completed });
  };

  TaskStore.prototype.remove = function (id) {
    var task = this._find(id);
    if (!task) return false;
    this._tasks.splice(this._tasks.indexOf(task), 1);
    this._reindex(task.quadrant);
    this._notify();
    return true;
  };

  /**
   * Move a task to another quadrant, optionally at a given index.
   *
   * Inside its own quadrant the index is the final position of the task in
   * the list. In another quadrant the index is the position at which the task
   * is inserted in the target list.
   */
  TaskStore.prototype.move = function (id, quadrantId, index) {
    var task = this._require(id);
    if (!quadrants.isQuadrantId(quadrantId)) throw new TypeError('unknown quadrant: ' + String(quadrantId));

    var sourceQuadrant = task.quadrant;
    var sourceList = this._ofQuadrant(sourceQuadrant, false);
    var oldIndex = sourceList.indexOf(task);
    var hasIndex = typeof index === 'number' && isFinite(index);
    var target = hasIndex ? Math.floor(index) : sourceList.length;

    if (sourceQuadrant === quadrantId) {
      var others = sourceList.filter(function (candidate) { return candidate !== task; });
      var insertAt = target;
      // The final position counts the task itself, the reduced list does not.
      if (insertAt > oldIndex) insertAt -= 1;
      if (insertAt < 0) insertAt = 0;
      if (insertAt > others.length) insertAt = others.length;
      others.splice(insertAt, 0, task);
      for (var i = 0; i < others.length; i++) others[i].order = i;
    } else {
      var list = this._ofQuadrant(quadrantId, false);
      var position = hasIndex ? Math.floor(index) : list.length;
      if (position < 0) position = 0;
      if (position > list.length) position = list.length;
      task.quadrant = quadrantId;
      list.splice(position, 0, task);
      for (var j = 0; j < list.length; j++) list[j].order = j;
      this._reindex(sourceQuadrant);
    }

    this._reindex(quadrantId);
    this._notify();
    return task;
  };

  /**
   * Reorder the tasks of a quadrant. The ids that are unknown or that belong
   * to another quadrant are ignored, the tasks that are not mentioned keep
   * their relative order at the end of the list.
   */
  TaskStore.prototype.reorder = function (quadrantId, ids) {
    if (!quadrants.isQuadrantId(quadrantId)) throw new TypeError('unknown quadrant: ' + String(quadrantId));
    var list = this._ofQuadrant(quadrantId, false);
    var byId = Object.create(null);
    for (var i = 0; i < list.length; i++) byId[list[i].id] = list[i];

    var ordered = [];
    var seen = Object.create(null);
    var wanted = Array.isArray(ids) ? ids : [];
    for (var j = 0; j < wanted.length; j++) {
      var id = wanted[j];
      if (seen[id]) continue;
      if (!byId[id]) continue;
      seen[id] = true;
      ordered.push(byId[id]);
    }
    for (var k = 0; k < list.length; k++) {
      if (!seen[list[k].id]) ordered.push(list[k]);
    }
    for (var m = 0; m < ordered.length; m++) ordered[m].order = m;
    this._reindex(quadrantId);
    this._notify();
    return ordered;
  };

  TaskStore.prototype.clearCompleted = function (quadrantId) {
    var removed = 0;
    for (var i = this._tasks.length - 1; i >= 0; i--) {
      var task = this._tasks[i];
      if (!task.completed) continue;
      if (quadrantId !== undefined && task.quadrant !== quadrantId) continue;
      this._tasks.splice(i, 1);
      removed += 1;
    }
    if (quadrantId !== undefined) this._reindex(quadrantId);
    this._notify();
    return removed;
  };

  TaskStore.prototype.counts = function () {
    var counts = {};
    var ids = quadrants.quadrantIds();
    for (var i = 0; i < ids.length; i++) {
      counts[ids[i]] = { total: 0, active: 0, completed: 0 };
    }
    for (var j = 0; j < this._tasks.length; j++) {
      var task = this._tasks[j];
      if (!counts[task.quadrant]) continue;
      counts[task.quadrant].total += 1;
      if (task.completed) counts[task.quadrant].completed += 1;
      else counts[task.quadrant].active += 1;
    }
    return counts;
  };

  TaskStore.prototype.toJSON = function () {
    return this.all().map(function (task) {
      return {
        id: task.id,
        text: task.text,
        quadrant: task.quadrant,
        completed: task.completed,
        order: task.order
      };
    });
  };

  return { TaskStore: TaskStore };
});

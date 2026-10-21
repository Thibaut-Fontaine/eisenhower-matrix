/**
 * Persistence layer.
 *
 * The tasks live in the browser localStorage under a versioned key. The first
 * run of the new application migrates the legacy array stored under the key
 * `tasks` (the format used by the old extension) into the versioned store.
 * The migration happens once and never loses a task: when the write fails the
 * legacy payload is left untouched.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'persistence', function (root) {
  'use strict';

  var taskModel = (typeof require === 'function')
    ? require('./task.js')
    : root.Eisenhower.task;
  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  var STORAGE_KEY = 'eisenhower.matrix.tasks';
  var LEGACY_KEY = 'tasks';
  var CURRENT_VERSION = 2;

  function nowIso() {
    return new Date().toISOString();
  }

  /**
   * Give the tasks of every quadrant a contiguous order.
   */
  function reindex(tasks) {
    var ids = quadrants.quadrantIds();
    for (var q = 0; q < ids.length; q++) {
      var quadrantId = ids[q];
      var active = tasks.filter(function (task) {
        return task.quadrant === quadrantId && !task.completed;
      });
      var done = tasks.filter(function (task) {
        return task.quadrant === quadrantId && task.completed;
      });
      for (var i = 0; i < active.length; i++) active[i].order = i;
      for (var j = 0; j < done.length; j++) done[j].order = active.length + j;
    }
    return tasks;
  }

  function quadrantFromLegacy(value, important, urgent) {
    if (typeof value === 'string' && quadrants.isQuadrantId(value)) return value;
    if (typeof value === 'number' && value >= 0 && value < quadrants.quadrantIds().length) {
      return quadrants.quadrantIds()[value];
    }
    return quadrants.quadrantIdFor(important === true, urgent === true);
  }

  /**
   * Convert the legacy array (`{ task, important, urgent }`) into tasks.
   */
  function migrateLegacyTasks(legacyTasks) {
    if (!Array.isArray(legacyTasks)) return [];
    var out = [];
    for (var i = 0; i < legacyTasks.length; i++) {
      var entry = legacyTasks[i];
      if (entry === null || entry === undefined) continue;
      var text;
      var important = false;
      var urgent = false;
      var quadrant = null;
      if (typeof entry === 'string') {
        text = entry;
      } else if (typeof entry === 'object') {
        text = entry.task !== undefined ? entry.task : entry.text;
        important = entry.important === true;
        urgent = entry.urgent === true;
        if (entry.quadrant !== undefined) quadrant = entry.quadrant;
      }
      if (typeof text !== 'string' || text.trim() === '') continue;
      out.push({
        id: taskModel.defaultIdFactory(),
        text: text.trim(),
        quadrant: quadrant !== null ? quadrantFromLegacy(quadrant, important, urgent)
          : quadrants.quadrantIdFor(important, urgent),
        completed: false,
        order: out.length
      });
    }
    return reindex(out);
  }

  /**
   * Migrate a stored payload to the current schema.
   */
  function migratePayload(payload) {
    if (Array.isArray(payload)) {
      return { version: CURRENT_VERSION, tasks: migrateLegacyTasks(payload) };
    }
    if (!payload || typeof payload !== 'object') {
      throw new Error('the stored payload is not an object');
    }
    var version = Number(payload.version);
    if (!isFinite(version)) version = 1;

    if (version === 1) {
      var legacy = Array.isArray(payload.tasks) ? payload.tasks : [];
      var migrated = [];
      for (var i = 0; i < legacy.length; i++) {
        var entry = legacy[i];
        if (!entry || typeof entry !== 'object') continue;
        var text = typeof entry.text === 'string' ? entry.text : entry.task;
        if (typeof text !== 'string' || text.trim() === '') continue;
        migrated.push({
          id: typeof entry.id === 'string' && entry.id !== '' ? entry.id : taskModel.defaultIdFactory(),
          text: text.trim(),
          quadrant: quadrantFromLegacy(entry.quadrant, entry.important === true, entry.urgent === true),
          completed: entry.done === true || entry.completed === true,
          order: typeof entry.position === 'number' ? entry.position
            : (typeof entry.order === 'number' ? entry.order : migrated.length)
        });
      }
      return { version: CURRENT_VERSION, tasks: reindex(migrated) };
    }

    if (version === CURRENT_VERSION) {
      var tasks = [];
      var list = Array.isArray(payload.tasks) ? payload.tasks : [];
      for (var j = 0; j < list.length; j++) {
        var normalised = taskModel.normaliseTask(list[j]);
        if (normalised) tasks.push(normalised);
      }
      return { version: CURRENT_VERSION, tasks: tasks };
    }

    throw new Error('unsupported payload version: ' + version);
  }

  /**
   * Write the tasks to the storage.
   */
  function save(tasks, storage, options) {
    var opts = options || {};
    var key = opts.key || STORAGE_KEY;
    var payload = {
      version: CURRENT_VERSION,
      updatedAt: nowIso(),
      tasks: Array.isArray(tasks) ? tasks : []
    };
    storage.setItem(key, JSON.stringify(payload));
    return payload;
  }

  function backup(storage, key, raw) {
    try {
      storage.setItem(key + '.corrupt', raw);
    } catch (error) {
      /* the backup is best effort, never fatal */
    }
  }

  function readLegacy(storage) {
    var raw;
    try {
      raw = storage.getItem(LEGACY_KEY);
    } catch (error) {
      return null;
    }
    if (raw === null || raw === undefined || raw === '') return null;
    // A Web Storage always hands back a string, but a host may keep the value
    // as a live array: accept both shapes.
    if (Array.isArray(raw)) return raw;
    try {
      var parsed = JSON.parse(raw);
      if (!Array.isArray(parsed)) return null;
      return parsed;
    } catch (error) {
      return null;
    }
  }

  /**
   * Read the tasks back.
   *
   * Returns { tasks, version, migrated, recovered, persisted }.
   */
  function load(storage, options) {
    var opts = options || {};
    var key = opts.key || STORAGE_KEY;
    var result = {
      tasks: [],
      version: CURRENT_VERSION,
      migrated: false,
      recovered: false,
      persisted: true
    };

    var raw = null;
    try {
      raw = storage.getItem(key);
    } catch (error) {
      raw = null;
    }

    if (raw !== null && raw !== undefined && raw !== '') {
      var payload = null;
      var parsedOk = true;
      try {
        payload = JSON.parse(raw);
      } catch (error) {
        parsedOk = false;
      }
      if (parsedOk) {
        try {
          var migrated = migratePayload(payload);
          result.tasks = migrated.tasks;
          result.version = migrated.version;
          result.migrated = Number(payload && payload.version) === 1;
          return result;
        } catch (error) {
          result.recovered = true;
          backup(storage, key, raw);
        }
      } else {
        result.recovered = true;
        backup(storage, key, raw);
      }
    }

    // No usable versioned payload: try the legacy array.
    var legacy = readLegacy(storage);
    if (legacy !== null) {
      var legacyTasks = migrateLegacyTasks(legacy);
      result.tasks = legacyTasks;
      result.migrated = true;
      try {
        save(legacyTasks, storage, { key: key });
        try {
          storage.removeItem(LEGACY_KEY);
        } catch (removeError) {
          /* the legacy payload stays, it will be migrated again next time */
        }
      } catch (error) {
        result.persisted = false;
      }
    }

    return result;
  }

  return {
    STORAGE_KEY: STORAGE_KEY,
    LEGACY_KEY: LEGACY_KEY,
    CURRENT_VERSION: CURRENT_VERSION,
    save: save,
    load: load,
    migratePayload: migratePayload,
    migrateLegacyTasks: migrateLegacyTasks,
    reindex: reindex
  };
});

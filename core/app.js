/**
 * The application controller.
 *
 * It is the glue between the core and the page: it owns the store, it reads
 * and writes the storage, it renders the matrix and it handles the pointer,
 * the keyboard and the toolbar. The extension page and the standalone web
 * app both use this controller, so they behave the same way.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'app', function (root) {
  'use strict';

  var taskModel = (typeof require === 'function') ? require('./task.js') : root.Eisenhower.task;
  var quadrants = (typeof require === 'function') ? require('./quadrants.js') : root.Eisenhower.quadrants;
  var storeModule = (typeof require === 'function') ? require('./store.js') : root.Eisenhower.store;
  var persistence = (typeof require === 'function') ? require('./persistence.js') : root.Eisenhower.persistence;
  var parser = (typeof require === 'function') ? require('./parser.js') : root.Eisenhower.parser;
  var interchange = (typeof require === 'function') ? require('./interchange.js') : root.Eisenhower.interchange;
  var render = (typeof require === 'function') ? require('./render.js') : root.Eisenhower.render;
  var drag = (typeof require === 'function') ? require('./drag.js') : root.Eisenhower.drag;
  var keyboard = (typeof require === 'function') ? require('./keyboard.js') : root.Eisenhower.keyboard;

  var TaskStore = storeModule.TaskStore;

  function element(doc, tag, className, text) {
    var node = doc.createElement(tag);
    if (className) node.className = className;
    if (text !== undefined && text !== null) node.textContent = text;
    return node;
  }

  function quadrantOptions(doc, selected) {
    var select = doc.createElement('select');
    select.className = 'quadrant-select';
    for (var i = 0; i < quadrants.QUADRANTS.length; i++) {
      var quadrant = quadrants.QUADRANTS[i];
      var option = doc.createElement('option');
      option.setAttribute('value', quadrant.id);
      option.textContent = quadrant.label;
      if (quadrant.id === selected) option.setAttribute('selected', 'selected');
      select.appendChild(option);
    }
    return select;
  }

  /**
   * Build the toolbar of the application: the add form, the paste panel, the
   * import and export actions and the live region.
   */
  function createToolbar(doc, options) {
    var toolbar = element(doc, 'div', 'app-toolbar');

    var form = element(doc, 'form', 'add-form');
    form.setAttribute('role', 'search');
    var input = element(doc, 'input', 'add-input');
    input.setAttribute('type', 'text');
    input.setAttribute('name', 'text');
    input.setAttribute('placeholder', 'What needs to be done?');
    input.setAttribute('aria-label', 'New task');
    var select = quadrantOptions(doc, options.defaultQuadrant);
    select.setAttribute('aria-label', 'Quadrant of the new task');
    select.className = 'add-quadrant';
    var submit = element(doc, 'button', 'add-button', 'Add task');
    submit.setAttribute('type', 'submit');
    form.appendChild(input);
    form.appendChild(select);
    form.appendChild(submit);
    toolbar.appendChild(form);

    var actions = element(doc, 'div', 'app-actions');

    var pasteButton = element(doc, 'button', 'action-button', 'Paste a list');
    pasteButton.setAttribute('type', 'button');
    pasteButton.setAttribute('data-action', 'toggle-paste');
    actions.appendChild(pasteButton);

    var exportJson = element(doc, 'button', 'action-button', 'Export JSON');
    exportJson.setAttribute('type', 'button');
    exportJson.setAttribute('data-action', 'export-json');
    actions.appendChild(exportJson);

    var exportCsv = element(doc, 'button', 'action-button', 'Export CSV');
    exportCsv.setAttribute('type', 'button');
    exportCsv.setAttribute('data-action', 'export-csv');
    actions.appendChild(exportCsv);

    var importButton = element(doc, 'button', 'action-button', 'Import');
    importButton.setAttribute('type', 'button');
    importButton.setAttribute('data-action', 'import');
    actions.appendChild(importButton);

    var file = element(doc, 'input', 'import-file');
    file.setAttribute('type', 'file');
    file.setAttribute('accept', '.json,.csv,application/json,text/csv');
    file.setAttribute('aria-label', 'Import a JSON or CSV file');
    actions.appendChild(file);

    toolbar.appendChild(actions);
    return toolbar;
  }

  function createPastePanel(doc) {
    var panel = element(doc, 'section', 'paste-panel');
    panel.hidden = true;

    var label = element(doc, 'label', 'paste-label', 'Paste a list of tasks');
    label.setAttribute('for', 'paste-text');
    var textarea = element(doc, 'textarea', 'paste-text');
    textarea.setAttribute('id', 'paste-text');
    textarea.setAttribute('rows', '6');
    textarea.setAttribute('placeholder', '- one task per line\n- [x] a task that is done');
    panel.appendChild(label);
    panel.appendChild(textarea);

    var preview = element(doc, 'div', 'paste-preview');
    preview.setAttribute('aria-live', 'polite');
    panel.appendChild(preview);

    var row = element(doc, 'div', 'paste-buttons');
    var previewButton = element(doc, 'button', 'action-button', 'Preview');
    previewButton.setAttribute('type', 'button');
    previewButton.setAttribute('data-action', 'paste-preview');
    var addButton = element(doc, 'button', 'action-button', 'Add the tasks');
    addButton.setAttribute('type', 'button');
    addButton.setAttribute('data-action', 'paste-add');
    var cancelButton = element(doc, 'button', 'action-button', 'Close');
    cancelButton.setAttribute('type', 'button');
    cancelButton.setAttribute('data-action', 'paste-close');
    row.appendChild(previewButton);
    row.appendChild(addButton);
    row.appendChild(cancelButton);
    panel.appendChild(row);

    return {
      panel: panel,
      textarea: textarea,
      preview: preview
    };
  }

  /**
   * The application.
   */
  function createApp(config) {
    var settings = config || {};
    var doc = settings.document;
    var storage = settings.storage;
    var mount = settings.mount;
    var options = settings.options || {};
    var compact = options.compact === true;
    if (!options.defaultQuadrant) options.defaultQuadrant = 'not-important-not-urgent';

    if (!doc) throw new TypeError('createApp needs a document');
    if (!mount) throw new TypeError('createApp needs a mount element');

    var state = {
      editingId: null,
      dragged: null,
      pasteItems: null
    };

    var loaded = persistence.load(storage);
    var store = new TaskStore({ tasks: loaded.tasks });

    var status = element(doc, 'div', 'app-status');
    status.setAttribute('role', 'status');
    status.setAttribute('aria-live', 'polite');

    var view = compact ? render.createCompactView(doc) : render.createMatrixView(doc);
    var toolbar = compact ? null : createToolbar(doc, options);
    var paste = compact ? null : createPastePanel(doc);

    var app = element(doc, 'div', 'app' + (compact ? ' app-compact' : ''));
    if (toolbar) app.appendChild(toolbar);
    if (paste) app.appendChild(paste.panel);
    app.appendChild(view.root);
    app.appendChild(status);
    mount.appendChild(app);

    function announce(message) {
      status.textContent = message || '';
    }

    function refresh() {
      // The focus is restored after the update: a task that is rebuilt must
      // not lose the focus of the user.
      var focused = focusedDescriptor();
      view.update(store, state);
      restoreFocus(focused);
    }

    function focusedDescriptor() {
      var active = doc.activeElement;
      if (!active || !active.getAttribute) return null;
      var node = active;
      var taskId = null;
      while (node && node.getAttribute) {
        if (node.getAttribute('data-task-id')) {
          taskId = node.getAttribute('data-task-id');
          break;
        }
        node = node.parentNode;
      }
      if (!taskId) return null;
      var action = null;
      if (active.getAttribute) action = active.getAttribute('data-action');
      return { taskId: taskId, action: action };
    }

    function restoreFocus(descriptor) {
      if (!descriptor) return;
      var selector = '[data-task-id="' + descriptor.taskId + '"]';
      var item = view.root.querySelector(selector);
      if (!item) return;
      var target = item;
      if (descriptor.action) {
        var action = item.querySelector('[data-action="' + descriptor.action + '"]');
        if (action) target = action;
      }
      if (target && target.focus) target.focus();
    }

    var unsubscribe = store.subscribe(function () {
      try {
        persistence.save(store.toJSON(), storage);
      } catch (error) {
        announce('The tasks could not be saved: ' + error.message);
      }
      refresh();
    });

    refresh();

    if (loaded.migrated) {
      announce('The tasks of the previous version were moved to the new format.');
    }
    if (loaded.recovered) {
      announce('The stored tasks were broken and could not be read. A backup was kept.');
    }

    // --- actions ---------------------------------------------------------

    function addTask(text, quadrantId) {
      try {
        var task = store.add(text, { quadrant: quadrantId });
        announce('The task was added.');
        return task;
      } catch (error) {
        announce(error.message);
        return null;
      }
    }

    function taskIdOf(node) {
      var item = node;
      while (item && item.getAttribute) {
        if (item.getAttribute('data-task-id')) return item.getAttribute('data-task-id');
        item = item.parentNode;
      }
      return null;
    }

    function quadrantOf(node) {
      var item = node;
      while (item && item.getAttribute) {
        if (item.getAttribute('data-quadrant')) return item.getAttribute('data-quadrant');
        item = item.parentNode;
      }
      return null;
    }

    function actionOf(node) {
      var item = node;
      while (item && item.getAttribute) {
        if (item.getAttribute('data-action')) return item.getAttribute('data-action');
        item = item.parentNode;
      }
      return null;
    }

    function startEdit(taskId) {
      state.editingId = taskId;
      refresh();
      var item = view.root.querySelector('[data-task-id="' + taskId + '"]');
      if (item) {
        var input = item.querySelector('.task-edit');
        if (input) input.focus();
      }
    }

    function saveEdit(taskId, text) {
      try {
        store.update(taskId, { text: text });
        state.editingId = null;
        refresh();
        announce('The task was updated.');
      } catch (error) {
        announce(error.message);
      }
    }

    function cancelEdit() {
      state.editingId = null;
      refresh();
    }

    function deleteTask(taskId) {
      if (store.remove(taskId)) announce('The task was deleted.');
    }

    function toggleTask(taskId) {
      var task = store.get(taskId);
      if (!task) return;
      store.toggleComplete(taskId);
    }

    function download(filename, content, mime) {
      var blob = new Blob([content], { type: mime });
      var url = URL.createObjectURL(blob);
      var link = element(doc, 'a', 'download-link');
      link.setAttribute('href', url);
      link.setAttribute('download', filename);
      link.textContent = 'Download';
      doc.body.appendChild(link);
      link.click();
      doc.body.removeChild(link);
      setTimeout(function () { URL.revokeObjectURL(url); }, 0);
    }

    function exportTasks(format) {
      var tasks = store.toJSON();
      if (format === 'csv') {
        download('eisenhower-matrix.csv', interchange.exportCsv(tasks), 'text/csv');
      } else {
        download('eisenhower-matrix.json', interchange.exportJson(tasks), 'application/json');
      }
      announce('The tasks were exported as ' + format.toUpperCase() + '.');
    }

    function importText(text) {
      var format = interchange.detectFormat(text);
      var tasks = [];
      try {
        tasks = format === 'json' ? interchange.importJson(text) : interchange.importCsv(text);
      } catch (error) {
        announce('The file could not be read: ' + error.message);
        return false;
      }
      var ids = {};
      for (var i = 0; i < store.all().length; i++) ids[store.all()[i].id] = true;
      var added = 0;
      for (var j = 0; j < tasks.length; j++) {
        if (ids[tasks[j].id]) tasks[j].id = undefined;
        if (store.add(tasks[j])) added += 1;
      }
      announce(added + ' task(s) were imported.');
      return true;
    }

    function parsePreview() {
      if (!paste) return;
      var items = parser.parsePaste(paste.textarea.value, {
        defaultQuadrant: options.defaultQuadrant
      });
      state.pasteItems = items;
      paste.preview.replaceChildren();
      if (items.length === 0) {
        paste.preview.appendChild(element(doc, 'p', 'paste-empty', 'No task found in this text.'));
        return;
      }
      var list = element(doc, 'ul', 'paste-list');
      for (var i = 0; i < items.length; i++) {
        var item = items[i];
        var row = element(doc, 'li', 'paste-item');
        var text = element(doc, 'span', 'paste-text', item.text);
        row.appendChild(text);
        var select = quadrantOptions(doc, item.quadrant);
        select.className = 'paste-quadrant';
        select.setAttribute('data-index', String(i));
        select.setAttribute('aria-label', 'Quadrant of “' + item.text + '”');
        row.appendChild(select);
        list.appendChild(row);
      }
      paste.preview.appendChild(list);
      announce(items.length + ' task(s) found.');
    }

    function addPreviewed() {
      if (!paste || !state.pasteItems) return;
      var added = 0;
      for (var i = 0; i < state.pasteItems.length; i++) {
        var item = state.pasteItems[i];
        var select = paste.preview.querySelector('[data-index="' + i + '"]');
        var quadrant = item.quadrant;
        if (select) {
          var chosen = select.value;
          if (quadrants.isQuadrantId(chosen)) quadrant = chosen;
        }
        try {
          store.add({ text: item.text, quadrant: quadrant, completed: item.completed });
          added += 1;
        } catch (error) {
          /* an invalid line is skipped */
        }
      }
      state.pasteItems = null;
      paste.textarea.value = '';
      paste.preview.replaceChildren();
      paste.panel.hidden = true;
      announce(added + ' task(s) were added.');
    }

    // --- the keyboard flow ----------------------------------------------

    var session = keyboard.createKeyboardSession({
      listSize: function (quadrantId) {
        return store.list(quadrantId).length;
      }
    });

    function grabbedId() {
      return session.grabbed ? session.grabbed.taskId : null;
    }

    function onKeyDown(event) {
      var item = event.target;
      if (!item || !item.getAttribute) return;

      // The edit field has its own keys.
      if (item.classList && item.classList.contains('task-edit')) {
        var editId = taskIdOf(item);
        if (event.key === 'Enter') {
          event.preventDefault();
          saveEdit(editId, item.value);
        } else if (event.key === 'Escape') {
          event.preventDefault();
          cancelEdit();
        }
        return;
      }
      if (item.tagName === 'TEXTAREA' || item.tagName === 'INPUT' || item.tagName === 'SELECT') return;

      var taskId = taskIdOf(item);
      if (!taskId) return;

      if (event.key === 'Delete' || event.key === 'Backspace') {
        if (session.isGrabbed() && session.grabbed.taskId !== taskId) return;
        event.preventDefault();
        deleteTask(taskId);
        return;
      }

      if (event.key === 'Enter' && !session.isGrabbed()) {
        // Enter picks a task up; the editing is done with the edit button.
      }

      var action = keyboard.keyAction(event);
      if (!action) return;
      event.preventDefault();

      if (action === 'grab') {
        if (session.isGrabbed()) {
          var drop = session.drop();
          if (drop) {
            applyMove(drop);
            announce('The task was moved.');
          }
        } else {
          var task = store.get(taskId);
          if (!task) return;
          var index = store.list(task.quadrant).map(function (candidate) { return candidate.id; }).indexOf(taskId);
          session.grab(taskId, task.quadrant, index);
          announce(session.announcement(task.text));
        }
        return;
      }

      if (action === 'cancel') {
        if (session.cancel()) announce('The move was cancelled.');
        return;
      }

      if (!session.isGrabbed() || session.grabbed.taskId !== taskId) return;
      var position = session.move(action);
      if (!position) return;
      announce(session.announcement(taskText(taskId)));
    }

    function taskText(taskId) {
      var task = store.get(taskId);
      return task ? task.text : '';
    }

    function applyMove(move) {
      if (!move || !move.taskId) return;
      var task = store.get(move.taskId);
      if (!task) return;
      var target = store.list(move.toQuadrant).map(function (candidate) { return candidate.id; });
      var index = move.index;
      if (move.fromQuadrant === move.toQuadrant) {
        var current = target.indexOf(move.taskId);
        if (current !== -1 && index > current) index -= 1;
      }
      if (index < 0) index = 0;
      if (index > target.length) index = target.length;
      store.move(move.taskId, move.toQuadrant, index);
    }

    // --- the pointer flow -------------------------------------------------

    var dragState = drag.createDragState();

    function sectionRects() {
      var rects = [];
      var ids = quadrants.quadrantIds();
      for (var i = 0; i < ids.length; i++) {
        var section = view.quadrantSection(ids[i]);
        if (!section || !section.getBoundingClientRect) continue;
        var rect = section.getBoundingClientRect();
        rects.push({
          id: ids[i],
          x: rect.left,
          y: rect.top,
          width: rect.width,
          height: rect.height
        });
      }
      return rects;
    }

    function taskRects(quadrantId) {
      var rects = [];
      var list = view.listElement(quadrantId);
      if (!list) return rects;
      var items = list.querySelectorAll('.task');
      for (var i = 0; i < items.length; i++) {
        if (!items[i].getBoundingClientRect) continue;
        var rect = items[i].getBoundingClientRect();
        rects.push({ x: rect.left, y: rect.top, width: rect.width, height: rect.height });
      }
      return rects;
    }

    function onPointerDown(event) {
      if (compact) return;
      var action = actionOf(event.target);
      if (action !== 'drag') return;
      var taskId = taskIdOf(event.target);
      if (!taskId) return;
      var task = store.get(taskId);
      if (!task) return;
      var index = store.list(task.quadrant).map(function (candidate) { return candidate.id; }).indexOf(taskId);
      drag.beginDrag(dragState, {
        taskId: taskId,
        quadrantId: task.quadrant,
        index: index,
        pointerId: event.pointerId
      });
      state.dragged = taskId;
      if (event.target.setPointerCapture && event.pointerId !== undefined) {
        try { event.target.setPointerCapture(event.pointerId); } catch (error) { /* not supported */ }
      }
      event.preventDefault();
      refresh();
    }

    function onPointerMove(event) {
      if (!dragState.active) return;
      var rects = sectionRects();
      var quadrantId = drag.hitQuadrant(rects, { x: event.clientX, y: event.clientY });
      if (!quadrantId) return;
      var index = drag.insertionIndex(taskRects(quadrantId), { x: event.clientX, y: event.clientY });
      drag.updateDrag(dragState, { quadrantId: quadrantId, index: index });
      announce(drag.dragAnnouncement(dragState, taskText(dragState.taskId)));
    }

    function onPointerUp() {
      if (!dragState.active) return;
      var move = drag.endDrag(dragState);
      state.dragged = null;
      if (move) {
        applyMove(move);
        announce('The task was moved.');
      }
      refresh();
    }

    // --- the events -------------------------------------------------------

    function onClick(event) {
      var action = actionOf(event.target);
      var taskId = taskIdOf(event.target);

      if (action === 'toggle' && taskId) {
        toggleTask(taskId);
        return;
      }
      if (action === 'edit' && taskId) {
        startEdit(taskId);
        return;
      }
      if (action === 'save' && taskId) {
        var input = view.root.querySelector('[data-task-id="' + taskId + '"] .task-edit');
        saveEdit(taskId, input ? input.value : '');
        return;
      }
      if (action === 'cancel-edit') {
        cancelEdit();
        return;
      }
      if (action === 'delete' && taskId) {
        deleteTask(taskId);
        return;
      }
      if (action === 'export-json') {
        exportTasks('json');
        return;
      }
      if (action === 'export-csv') {
        exportTasks('csv');
        return;
      }
      if (action === 'import') {
        var file = app.querySelector('.import-file');
        if (file) file.click();
        return;
      }
      if (action === 'toggle-paste') {
        if (paste) {
          paste.panel.hidden = !paste.panel.hidden;
          if (!paste.panel.hidden) paste.textarea.focus();
        }
        return;
      }
      if (action === 'paste-preview') {
        parsePreview();
        return;
      }
      if (action === 'paste-add') {
        addPreviewed();
        return;
      }
      if (action === 'paste-close') {
        if (paste) {
          paste.panel.hidden = true;
          state.pasteItems = null;
          paste.preview.replaceChildren();
        }
      }
    }

    function onSubmit(event) {
      var form = event.target;
      if (!form || !form.classList || !form.classList.contains('add-form')) return;
      event.preventDefault();
      var input = form.querySelector('.add-input');
      var select = form.querySelector('.add-quadrant');
      if (!input) return;
      var text = input.value;
      input.value = '';
      if (text.trim() === '') {
        announce('A task needs some text.');
        return;
      }
      addTask(text, select ? select.value : undefined);
    }

    function onChange(event) {
      var target = event.target;
      if (!target || !target.getAttribute) return;
      if (target.classList && target.classList.contains('import-file')) {
        var file = target.files && target.files[0];
        if (!file) return;
        var reader = new FileReader();
        reader.onload = function () {
          importText(String(reader.result));
          target.value = '';
        };
        reader.readAsText(file);
        return;
      }
      if (target.classList && target.classList.contains('move-select')) {
        var taskId = target.getAttribute('data-task-id');
        if (taskId) {
          store.update(taskId, { quadrant: target.value });
          announce('The task was moved.');
        }
      }
    }

    app.addEventListener('click', onClick);
    app.addEventListener('submit', onSubmit);
    app.addEventListener('change', onChange);
    app.addEventListener('keydown', onKeyDown);
    app.addEventListener('pointerdown', onPointerDown);
    app.addEventListener('pointermove', onPointerMove);
    app.addEventListener('pointerup', onPointerUp);
    app.addEventListener('pointercancel', onPointerUp);

    return {
      store: store,
      view: view,
      state: state,
      refresh: refresh,
      announce: announce,
      addTask: addTask,
      importText: importText,
      exportText: function (format) {
        return format === 'csv'
          ? interchange.exportCsv(store.toJSON())
          : interchange.exportJson(store.toJSON());
      },
      destroy: function () {
        unsubscribe();
        if (mount.removeChild) mount.removeChild(app);
      }
    };
  }

  return { createApp: createApp };
});

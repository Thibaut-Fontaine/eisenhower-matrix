/**
 * The renderer.
 *
 * The matrix is built with the DOM API only: every piece of user text is
 * inserted with `textContent`, never as markup. The renderer never listens
 * to an event: the application controller delegates the events on the root
 * of the view.
 */
;(function (root, name, factory) {
  'use strict';
  var api = factory(root);
  if (typeof module === 'object' && module.exports) module.exports = api;
  else { root.Eisenhower = root.Eisenhower || {}; root.Eisenhower[name] = api; }
})(typeof globalThis !== 'undefined' ? globalThis : this, 'render', function (root) {
  'use strict';

  var quadrants = (typeof require === 'function')
    ? require('./quadrants.js')
    : root.Eisenhower.quadrants;

  function createButton(doc, action, label) {
    var button = doc.createElement('button');
    button.setAttribute('type', 'button');
    button.className = 'task-action';
    button.setAttribute('data-action', action);
    button.textContent = label;
    return button;
  }

  /**
   * Build one task of the matrix.
   *
   * options: { id, text, completed }
   * state:   { editingId } - the task being edited is rendered with an input
   */
  function createTaskItem(doc, options, state) {
    var opts = options || {};
    var current = state || {};
    var text = typeof opts.text === 'string' ? opts.text : '';
    var completed = opts.completed === true;

    var item = doc.createElement('li');
    item.className = 'task' + (completed ? ' task-completed' : '');
    item.setAttribute('data-task-id', String(opts.id));
    item.setAttribute('tabindex', '0');
    item.setAttribute('role', 'listitem');
    item.setAttribute('aria-grabbed', 'false');

    var checkbox = doc.createElement('input');
    checkbox.setAttribute('type', 'checkbox');
    checkbox.className = 'task-complete';
    checkbox.setAttribute('data-action', 'toggle');
    checkbox.setAttribute('aria-label', 'Mark “' + text + '” as done');
    checkbox.checked = completed;
    item.appendChild(checkbox);

    if (current.editingId !== undefined && current.editingId !== null && String(current.editingId) === String(opts.id)) {
      var input = doc.createElement('input');
      input.setAttribute('type', 'text');
      input.className = 'task-edit';
      input.setAttribute('data-action', 'edit-input');
      input.setAttribute('aria-label', 'Edit the task');
      input.value = text;
      item.appendChild(input);
      item.appendChild(createButton(doc, 'save', 'Save'));
      item.appendChild(createButton(doc, 'cancel-edit', 'Cancel'));
    } else {
      var label = doc.createElement('span');
      label.className = 'task-text';
      label.textContent = text;
      item.appendChild(label);
      item.appendChild(createButton(doc, 'edit', 'Edit'));
    }

    item.appendChild(createButton(doc, 'delete', 'Delete'));

    var handle = doc.createElement('span');
    handle.className = 'task-handle';
    handle.setAttribute('data-action', 'drag');
    handle.setAttribute('aria-hidden', 'true');
    handle.textContent = '⠿';
    item.appendChild(handle);

    return item;
  }

  /**
   * Build the matrix.
   *
   * The view keeps its sections: `update` only refills the lists, so the
   * focus of the user is not lost when a task changes.
   */
  function createMatrixView(doc) {
    var root = doc.createElement('div');
    root.className = 'matrix';
    root.setAttribute('role', 'group');
    root.setAttribute('aria-label', 'Eisenhower matrix');

    var views = {};
    // The items are shared by the four quadrants: a task that moves keeps
    // its element, and with it the focus of the user.
    var items = {};

    /**
     * The item of a task is created once and then reused, so the focus of
     * the user survives a move.
     */
    function itemFor(view, task, state) {
      var item = items[task.id];
      if (!item) {
        item = createTaskItem(doc, {
          id: task.id,
          text: task.text,
          completed: task.completed
        }, state);
        items[task.id] = item;
        return item;
      }
      return updateTaskItem(doc, item, task, state);
    }

    for (var i = 0; i < quadrants.QUADRANTS.length; i++) {
      var quadrant = quadrants.QUADRANTS[i];

      var section = doc.createElement('section');
      section.className = 'quadrant';
      section.setAttribute('data-quadrant', quadrant.id);
      section.style.setProperty('--quadrant-color', quadrant.color);

      var header = doc.createElement('header');
      header.className = 'quadrant-header';

      var title = doc.createElement('h2');
      title.className = 'quadrant-title';
      title.textContent = quadrant.label;
      header.appendChild(title);

      var description = doc.createElement('p');
      description.className = 'quadrant-description';
      description.textContent = quadrant.description;
      header.appendChild(description);

      var count = doc.createElement('span');
      count.className = 'quadrant-count';
      count.textContent = '0';
      header.appendChild(count);

      section.appendChild(header);

      var list = doc.createElement('ul');
      list.className = 'task-list';
      list.setAttribute('role', 'list');
      list.setAttribute('data-quadrant', quadrant.id);
      section.appendChild(list);

      var completed = doc.createElement('details');
      completed.className = 'completed';

      var summary = doc.createElement('summary');
      summary.className = 'completed-summary';

      var completedLabel = doc.createElement('span');
      completedLabel.className = 'completed-label';
      completedLabel.textContent = 'Completed';
      summary.appendChild(completedLabel);

      var completedCount = doc.createElement('span');
      completedCount.className = 'completed-count';
      completedCount.textContent = '0';
      summary.appendChild(completedCount);

      completed.appendChild(summary);

      var completedList = doc.createElement('ul');
      completedList.className = 'completed-list';
      completedList.setAttribute('role', 'list');
      completed.appendChild(completedList);

      section.appendChild(completed);
      root.appendChild(section);

      views[quadrant.id] = {
        section: section,
        list: list,
        completedList: completedList,
        count: count,
        completedCount: completedCount,
        items: {}
      };
    }

    function update(store, state) {
      var current = state || {};
      for (var j = 0; j < quadrants.QUADRANTS.length; j++) {
        var id = quadrants.QUADRANTS[j].id;
        var view = views[id];
        var active = store.list(id);
        var done = store.completedList(id);

        var items = [];
        for (var k = 0; k < active.length; k++) {
          items.push(itemFor(view, active[k], current));
        }
        syncList(view.list, items);

        var doneItems = [];
        for (var m = 0; m < done.length; m++) {
          doneItems.push(itemFor(view, done[m], current));
        }
        syncList(view.completedList, doneItems);

        view.count.textContent = String(active.length);
        view.completedCount.textContent = String(done.length);
      }
    }

    return {
      root: root,
      update: update,
      quadrantSection: function (id) {
        return views[id] ? views[id].section : null;
      },
      listElement: function (id) {
        return views[id] ? views[id].list : null;
      },
      completedListElement: function (id) {
        return views[id] ? views[id].completedList : null;
      },
      taskElement: function (id) {
        return root.querySelector('[data-task-id="' + id + '"]');
      }
    };
  }

  /**
   * Update a task item in place: the element is kept, only its content
   * changes, so the focus of the user is never lost.
   */
  function updateTaskItem(doc, item, task, state) {
    var fresh = createTaskItem(doc, {
      id: task.id,
      text: task.text,
      completed: task.completed
    }, state);
    item.setAttribute('data-task-id', fresh.getAttribute('data-task-id'));
    item.setAttribute('aria-grabbed', fresh.getAttribute('aria-grabbed'));
    item.className = fresh.className;
    var old = item.childNodes.slice();
    for (var j = 0; j < old.length; j++) item.removeChild(old[j]);
    var children = fresh.childNodes.slice();
    for (var i = 0; i < children.length; i++) item.appendChild(children[i]);
    return item;
  }

  /**
   * Put the items in the list in the given order without detaching the ones
   * that stay in place.
   */
  function syncList(list, items) {
    for (var i = 0; i < items.length; i++) {
      var current = list.childNodes[i];
      if (current !== items[i]) list.insertBefore(items[i], current || null);
    }
    while (list.childNodes.length > items.length) {
      list.removeChild(list.childNodes[list.childNodes.length - 1]);
    }
  }

  /**
   * The compact view used by the extension popup: a short list of the tasks
   * with a completion box, a move selector and a delete button.
   */
  function createCompactView(doc) {
    var root = doc.createElement('div');
    root.className = 'compact';

    function update(store, state) {
      var current = state || {};
      root.replaceChildren();
      var groups = [];
      for (var i = 0; i < quadrants.QUADRANTS.length; i++) {
        var quadrant = quadrants.QUADRANTS[i];
        var tasks = store.list(quadrant.id).concat(store.completedList(quadrant.id));
        if (tasks.length === 0) continue;

        var section = doc.createElement('section');
        section.className = 'compact-group';
        section.setAttribute('data-quadrant', quadrant.id);

        var title = doc.createElement('h2');
        title.className = 'compact-title';
        title.textContent = quadrant.label;
        section.appendChild(title);

        var list = doc.createElement('ul');
        list.className = 'compact-list';
        list.setAttribute('role', 'list');

        for (var j = 0; j < tasks.length; j++) {
          var task = tasks[j];
          var item = doc.createElement('li');
          item.className = 'compact-task' + (task.completed ? ' task-completed' : '');
          item.setAttribute('data-task-id', task.id);

          var checkbox = doc.createElement('input');
          checkbox.setAttribute('type', 'checkbox');
          checkbox.className = 'task-complete';
          checkbox.setAttribute('data-action', 'toggle');
          checkbox.setAttribute('aria-label', 'Mark “' + task.text + '” as done');
          checkbox.checked = task.completed;
          item.appendChild(checkbox);

          var label = doc.createElement('span');
          label.className = 'task-text';
          label.textContent = task.text;
          item.appendChild(label);

          var select = doc.createElement('select');
          select.className = 'move-select';
          select.setAttribute('data-task-id', task.id);
          select.setAttribute('aria-label', 'Quadrant of “' + task.text + '”');
          for (var k = 0; k < quadrants.QUADRANTS.length; k++) {
            var option = doc.createElement('option');
            option.setAttribute('value', quadrants.QUADRANTS[k].id);
            option.textContent = quadrants.QUADRANTS[k].label;
            if (quadrants.QUADRANTS[k].id === task.quadrant) option.setAttribute('selected', 'selected');
            select.appendChild(option);
          }
          item.appendChild(select);

          item.appendChild(createButton(doc, 'delete', 'Delete'));
          list.appendChild(item);
        }

        section.appendChild(list);
        root.appendChild(section);
        groups.push(section);
      }

      if (groups.length === 0) {
        var empty = doc.createElement('p');
        empty.className = 'compact-empty';
        empty.textContent = 'No task yet.';
        root.appendChild(empty);
      }
    }

    return { root: root, update: update };
  }

  return {
    createMatrixView: createMatrixView,
    createCompactView: createCompactView,
    createTaskItem: createTaskItem
  };
});

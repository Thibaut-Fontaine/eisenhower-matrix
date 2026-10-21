/**
 * The boot script.
 *
 * The same file starts the standalone web app and the matrix page of the
 * extension: the only difference is the element the application is mounted
 * in and the compact mode used by the popup.
 */
(function () {
  'use strict';

  function start() {
    var mount = document.getElementById('app');
    if (!mount) return;
    if (mount.getAttribute('data-compact') === 'true') {
      Eisenhower.app.createApp({
        document: document,
        storage: window.localStorage,
        mount: mount,
        options: { compact: true, defaultQuadrant: 'not-important-not-urgent' }
      });
      return;
    }
    Eisenhower.app.createApp({
      document: document,
      storage: window.localStorage,
      mount: mount,
      options: { defaultQuadrant: 'not-important-not-urgent' }
    });
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', start);
  } else {
    start();
  }
})();

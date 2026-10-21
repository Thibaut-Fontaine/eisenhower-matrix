/**
 * A very small DOM double.
 *
 * It implements the subset of the DOM that the renderer and the application
 * controller use: element creation, children, text, attributes, data
 * attributes, class lists, values, events with bubbling, and the two
 * selectors the code needs.
 *
 * The double refuses to accept `innerHTML`: the matrix must never turn user
 * text into markup, and a stub that throws on `innerHTML` proves it.
 */

class DomEvent {
  constructor(type, init = {}) {
    this.type = type;
    this.target = init.target ?? null;
    this.currentTarget = null;
    this.defaultPrevented = false;
    this.key = init.key;
    this.button = init.button;
    this.pointerId = init.pointerId;
    this.clientX = init.clientX;
    this.clientY = init.clientY;
    this.shiftKey = init.shiftKey;
    this.ctrlKey = init.ctrlKey;
    this.metaKey = init.metaKey;
    this.altKey = init.altKey;
    this.detail = init.detail;
  }

  preventDefault() {
    this.defaultPrevented = true;
  }

  stopPropagation() {
    this.stopped = true;
  }
}

function matchesSimple(el, simple) {
  // Supports a compound of "tag", "#id", ".class" and "[attr]" / "[attr=value]".
  const tokens = simple.match(/^[a-zA-Z][\w-]*|#[^.#\[]+|\.[^.#\[]+|\[[^\]]+\]/g);
  if (!tokens) return false;
  return tokens.every((token) => {
    if (token.startsWith('#')) return el.getAttribute('id') === token.slice(1);
    if (token.startsWith('.')) return el.classList.contains(token.slice(1));
    if (token.startsWith('[')) {
      const attrMatch = token.match(/^\[([^\]=]+)(?:=["']?([^\]"']*)["']?)?\]$/);
      if (!attrMatch) return false;
      const name = attrMatch[1];
      const value = attrMatch[2];
      if (value === undefined) return el.hasAttribute(name);
      return el.getAttribute(name) === value;
    }
    return el.tagName === token.toUpperCase();
  });
}

function matches(el, selector) {
  const parts = selector.trim().split(/\s+/);
  let index = parts.length - 1;
  if (!matchesSimple(el, parts[index])) return false;
  let node = el.parentNode;
  index -= 1;
  while (index >= 0 && node) {
    if (matchesSimple(node, parts[index])) index -= 1;
    node = node.parentNode;
  }
  return index < 0;
}

class ClassList {
  constructor(element) {
    this.element = element;
  }

  _list() {
    const value = this.element.getAttribute('class') || '';
    return value.split(/\s+/).filter(Boolean);
  }

  _write(list) {
    this.element.setAttribute('class', list.join(' '));
  }

  contains(name) {
    return this._list().includes(name);
  }

  add(...names) {
    const list = this._list();
    for (const name of names) if (!list.includes(name)) list.push(name);
    this._write(list);
  }

  remove(...names) {
    this._write(this._list().filter((name) => !names.includes(name)));
  }

  toggle(name, force) {
    const has = this.contains(name);
    const wanted = force === undefined ? !has : !!force;
    if (wanted) this.add(name);
    else this.remove(name);
    return wanted;
  }
}

class Style {
  constructor() {
    this.properties = new Map();
  }

  setProperty(name, value) {
    this.properties.set(name, String(value));
  }

  getPropertyValue(name) {
    return this.properties.get(name) || '';
  }

  removeProperty(name) {
    this.properties.delete(name);
  }
}

class Element {
  constructor(tagName, ownerDocument) {
    this.tagName = String(tagName).toUpperCase();
    this.ownerDocument = ownerDocument;
    this.childNodes = [];
    this.parentNode = null;
    this.attributes = new Map();
    this.dataset = {};
    this.classList = new ClassList(this);
    this.listeners = new Map();
    this.style = new Style();
    this._value = '';
    this.checked = false;
    this.disabled = false;
    this.hidden = false;
    this.focused = false;
    this._text = null;
  }

  get children() {
    return this.childNodes.filter((node) => node instanceof Element);
  }

  get firstChild() {
    return this.childNodes.length > 0 ? this.childNodes[0] : null;
  }

  get lastChild() {
    return this.childNodes.length > 0 ? this.childNodes[this.childNodes.length - 1] : null;
  }

  get parentElement() {
    return this.parentNode instanceof Element ? this.parentNode : null;
  }

  get id() {
    return this.getAttribute('id') || '';
  }

  get value() {
    if (this.tagName === 'SELECT') {
      const options = this.querySelectorAll('option');
      const selected = options.find((option) => option.hasAttribute('selected'));
      const chosen = selected || options[0];
      if (!chosen) return '';
      return chosen.getAttribute('value') || chosen.textContent;
    }
    return this._value;
  }

  set value(next) {
    this._value = next === null || next === undefined ? '' : String(next);
    if (this.tagName === 'SELECT') {
      // A select holds the value of its selected option.
      for (const option of this.querySelectorAll('option')) {
        if (option.getAttribute('value') === this._value) option.setAttribute('selected', 'selected');
        else option.removeAttribute('selected');
      }
    }
  }

  set id(value) {
    this.setAttribute('id', value);
  }

  get className() {
    return this.getAttribute('class') || '';
  }

  set className(value) {
    this.setAttribute('class', value);
  }

  get textContent() {
    if (this._text !== null) return this._text;
    return this.childNodes.map((node) => node.textContent).join('');
  }

  set textContent(value) {
    this.childNodes = [];
    this._text = value === null || value === undefined ? '' : String(value);
  }

  get innerHTML() {
    throw new Error('innerHTML must never be used: the matrix inserts text, not markup');
  }

  set innerHTML(value) {
    throw new Error('innerHTML must never be used: the matrix inserts text, not markup');
  }

  appendChild(child) {
    if (child.parentNode) child.parentNode.removeChild(child);
    this._text = null;
    this.childNodes.push(child);
    child.parentNode = this;
    return child;
  }

  append(...nodes) {
    for (const node of nodes) this.appendChild(node);
  }

  removeChild(child) {
    const index = this.childNodes.indexOf(child);
    if (index !== -1) this.childNodes.splice(index, 1);
    child.parentNode = null;
    return child;
  }

  insertBefore(node, reference) {
    if (node.parentNode) node.parentNode.removeChild(node);
    this._text = null;
    const index = reference ? this.childNodes.indexOf(reference) : -1;
    if (index === -1) this.childNodes.push(node);
    else this.childNodes.splice(index, 0, node);
    node.parentNode = this;
    return node;
  }

  remove() {
    if (this.parentNode) this.parentNode.removeChild(this);
  }

  replaceChildren(...nodes) {
    for (const child of this.childNodes) child.parentNode = null;
    this.childNodes = [];
    this._text = null;
    for (const node of nodes) this.appendChild(node);
  }

  setAttribute(name, value) {
    this.attributes.set(name, String(value));
    if (name.startsWith('data-')) {
      const key = name.slice(5).replace(/-([a-z])/g, (_, c) => c.toUpperCase());
      this.dataset[key] = String(value);
    }
  }

  getAttribute(name) {
    return this.attributes.has(name) ? this.attributes.get(name) : null;
  }

  hasAttribute(name) {
    return this.attributes.has(name);
  }

  removeAttribute(name) {
    this.attributes.delete(name);
  }

  addEventListener(type, handler) {
    if (!this.listeners.has(type)) this.listeners.set(type, []);
    this.listeners.get(type).push(handler);
  }

  removeEventListener(type, handler) {
    const list = this.listeners.get(type) || [];
    const index = list.indexOf(handler);
    if (index !== -1) list.splice(index, 1);
  }

  dispatchEvent(event) {
    event.target = event.target || this;
    let node = this;
    while (node) {
      event.currentTarget = node;
      const list = node.listeners.get(event.type) || [];
      for (const handler of list.slice()) handler.call(node, event);
      if (event.stopped) break;
      node = node.parentNode;
    }
    return !event.defaultPrevented;
  }

  focus() {
    this.focused = true;
    if (this.ownerDocument) this.ownerDocument.activeElement = this;
  }

  blur() {
    this.focused = false;
  }

  click() {
    this.dispatchEvent(new DomEvent('click', { target: this }));
  }

  querySelector(selector) {
    return this.querySelectorAll(selector)[0] || null;
  }

  querySelectorAll(selector) {
    const out = [];
    const visit = (node) => {
      for (const child of node.childNodes) {
        if (child instanceof Element) {
          if (matches(child, selector)) out.push(child);
          visit(child);
        }
      }
    };
    visit(this);
    return out;
  }

  getBoundingClientRect() {
    return { x: 0, y: 0, top: 0, left: 0, right: 0, bottom: 0, width: 0, height: 0 };
  }
}

class TextNode {
  constructor(text) {
    this._text = String(text);
    this.parentNode = null;
  }

  get textContent() {
    return this._text;
  }

  set textContent(value) {
    this._text = String(value);
  }
}

class Document {
  constructor() {
    this.activeElement = null;
    this.documentElement = new Element('html', this);
    this.body = new Element('body', this);
    this.documentElement.appendChild(this.body);
  }

  createElement(tag) {
    return new Element(tag, this);
  }

  createTextNode(text) {
    return new TextNode(text);
  }

  getElementById(id) {
    return this.body.querySelector(`#${id}`);
  }

  querySelector(selector) {
    return this.body.querySelector(selector);
  }

  querySelectorAll(selector) {
    return this.body.querySelectorAll(selector);
  }

  addEventListener() {}

  removeEventListener() {}
}

/** Build a document and return it together with its helpers. */
export function createDocument() {
  return new Document();
}

export { DomEvent, Element, Document };

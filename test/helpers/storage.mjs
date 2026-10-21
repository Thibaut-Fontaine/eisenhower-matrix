/**
 * In-memory Storage double for the persistence tests.
 *
 * It implements the subset of the Web Storage API that the core uses:
 * getItem, setItem, removeItem, clear and a `length`/`key()` pair.
 */
export function createMemoryStorage(initial = {}) {
  const data = new Map(Object.entries(initial));

  return {
    get length() {
      return data.size;
    },
    key(index) {
      return [...data.keys()][index] ?? null;
    },
    getItem(key) {
      return data.has(key) ? data.get(key) : null;
    },
    setItem(key, value) {
      data.set(String(key), String(value));
    },
    removeItem(key) {
      data.delete(key);
    },
    clear() {
      data.clear();
    },
    /** Test helper: raw snapshot of the stored data. */
    dump() {
      return Object.fromEntries(data);
    },
  };
}

/**
 * A storage whose writes always fail, used to prove that a failed save
 * never destroys the data that is already on disk.
 */
export function createFailingStorage(message = 'quota exceeded') {
  const inner = createMemoryStorage();
  return {
    get length() {
      return inner.length;
    },
    key: (index) => inner.key(index),
    getItem: (key) => inner.getItem(key),
    removeItem: (key) => inner.removeItem(key),
    clear: () => inner.clear(),
    setItem() {
      throw new Error(message);
    },
  };
}

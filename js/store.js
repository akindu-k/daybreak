const PREFIX = "daybreak.cache.";

/** Returns today's local date as YYYY-MM-DD. */
export function todayStamp() {
  return new Date().toLocaleDateString("en-CA");
}

/** Reads a cached entry with its stamp, or null when there is none. */
export function readEntry(name) {
  try {
    return JSON.parse(localStorage.getItem(PREFIX + name));
  } catch {
    return null;
  }
}

/** Reads a cached value, or null when it is missing or was saved under a different stamp. */
export function readCache(name, stamp) {
  const entry = readEntry(name);
  return entry?.stamp === stamp ? entry.value : null;
}

/** Caches a value under a stamp; a full or blocked storage only costs a repeat request later. */
export function writeCache(name, stamp, value) {
  try {
    localStorage.setItem(PREFIX + name, JSON.stringify({ stamp, value }));
  } catch {
    // Storage unavailable.
  }
}

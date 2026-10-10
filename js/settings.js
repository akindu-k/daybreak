const STORAGE_KEY = "daybreak.settings";
const DEFAULTS = { githubToken: "", apiKey: "", model: "", repos: "", remember: true };

/** Reads settings from browser storage, falling back to defaults. */
export function loadSettings() {
  const raw = localStorage.getItem(STORAGE_KEY) ?? sessionStorage.getItem(STORAGE_KEY);
  try {
    return { ...DEFAULTS, ...JSON.parse(raw ?? "{}") };
  } catch {
    return { ...DEFAULTS };
  }
}

/** Saves settings to local storage when remembered, otherwise to this tab only. */
export function saveSettings(settings) {
  const [target, other] = settings.remember ? [localStorage, sessionStorage] : [sessionStorage, localStorage];
  other.removeItem(STORAGE_KEY);
  target.setItem(STORAGE_KEY, JSON.stringify(settings));
}

/** Removes every value this app stored, leaving other sites on the same origin untouched. */
export function clearStoredData() {
  for (const storage of [localStorage, sessionStorage]) {
    Object.keys(storage)
      .filter((key) => key.startsWith("daybreak."))
      .forEach((key) => storage.removeItem(key));
  }
}

/** Returns true when the dashboard has what it needs to load. */
export function isConfigured(settings) {
  return Boolean(settings.githubToken);
}

/** Returns true when planning and briefings can call the API. */
export function canPlan(settings) {
  return Boolean(settings.apiKey && settings.model);
}

/** Parses the repository filter into a list of owner/name strings. */
export function parseRepos(text) {
  return text
    .split(/[\s,]+/)
    .map((repo) => repo.trim())
    .filter((repo) => /^[\w.-]+\/[\w.-]+$/.test(repo));
}

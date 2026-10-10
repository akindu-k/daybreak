import { el, mount } from "./dom.js";
import { fetchPrDetail, fetchWorkload } from "./github.js";
import { clearStoredData, isConfigured, loadSettings, parseRepos, saveSettings } from "./settings.js";
import { normalizeWorkload } from "./triage.js";
import { renderDashboard } from "./views/dashboard.js";
import { renderHeader } from "./views/header.js";
import { renderIssueDetail } from "./views/issue.js";
import { renderPrDetail } from "./views/pr.js";
import { renderSettings } from "./views/settings.js";

const app = document.getElementById("app");
const state = { workload: null, loading: false, error: "", prDetails: new Map() };

/** Parses the location hash into a view name and an optional item key. */
function currentRoute() {
  const [view, owner, name, number] = location.hash.replace(/^#\/?/, "").split("/");
  if (view === "settings") return { view };
  if ((view === "pr" || view === "issue") && number) return { view, key: `${owner}/${name}#${number}` };
  return { view: "home" };
}

/** Reloads pull requests and issues from GitHub. */
async function refresh() {
  const settings = loadSettings();
  state.loading = true;
  render();
  try {
    state.workload = normalizeWorkload(await fetchWorkload(settings.githubToken, parseRepos(settings.repos)));
    state.prDetails.clear();
    state.error = "";
  } catch (error) {
    state.error = error.message;
  }
  state.loading = false;
  render();
}

/** Fetches reviews, threads and checks for a pull request once per refresh. */
async function loadPrDetail(pr) {
  state.prDetails.set(pr.key, {});
  try {
    state.prDetails.set(pr.key, { detail: await fetchPrDetail(loadSettings().githubToken, pr.repo, pr.number) });
  } catch (error) {
    state.prDetails.set(pr.key, { error: error.message });
  }
  render();
}

/** Renders the detail pane for the selected item, if any. */
function renderDetail(route) {
  if (route.view === "pr") {
    const pr = state.workload.prs.find((item) => item.key === route.key);
    if (!pr) return null;
    if (!state.prDetails.has(pr.key)) loadPrDetail(pr);
    return renderPrDetail(pr, state.prDetails.get(pr.key));
  }
  if (route.view === "issue") {
    const issue = state.workload.issues.find((item) => item.key === route.key);
    return issue ? renderIssueDetail(issue) : null;
  }
  return null;
}

/** Saves settings and reloads the dashboard. */
function handleSave(settings) {
  saveSettings(settings);
  location.hash = "#/";
  refresh();
}

/** Wipes stored settings and cached data. */
function handleClear() {
  clearStoredData();
  state.workload = null;
  render();
}

/** Renders the whole page for the current route. */
function render() {
  const route = currentRoute();
  const settings = loadSettings();
  const configured = isConfigured(settings);
  const header = renderHeader({ login: state.workload?.login, loading: state.loading, onRefresh: configured ? refresh : null });
  const banner = state.error && el("p", { class: "error" }, state.error);

  if (route.view === "settings" || !configured) {
    mount(app, header, renderSettings(settings, { onSave: handleSave, onClear: handleClear }));
  } else if (!state.workload) {
    mount(app, header, banner || el("p", { class: "muted empty" }, "Loading your pull requests and issues…"));
  } else {
    mount(app, header, renderDashboard({ workload: state.workload, selectedKey: route.key, top: banner, detail: renderDetail(route) }));
  }
}

window.addEventListener("hashchange", render);
if (isConfigured(loadSettings())) refresh();
else render();

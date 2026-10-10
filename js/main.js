import { downloadText, el, mount } from "./dom.js";
import { explainerRequest, explainerStatus, explainerToMarkdown } from "./explainer.js";
import { fetchPrDetail, fetchPrDiff, fetchWorkload } from "./github.js";
import { generateJson, listModels } from "./llm.js";
import { briefingRequest, planRequest, planToMarkdown } from "./planner.js";
import { canPlan, clearStoredData, isConfigured, loadSettings, parseRepos, saveSettings } from "./settings.js";
import { readCache, readEntry, todayStamp, writeCache } from "./store.js";
import { normalizeWorkload } from "./triage.js";
import { renderBriefing } from "./views/briefing.js";
import { renderDashboard } from "./views/dashboard.js";
import { explainerTag, renderExplainer } from "./views/explainer.js";
import { renderHeader } from "./views/header.js";
import { renderIssueDetail } from "./views/issue.js";
import { renderPlan } from "./views/plan.js";
import { renderPrDetail } from "./views/pr.js";
import { renderSettings } from "./views/settings.js";

const AUTO_REFRESH_MS = 15 * 60 * 1000;
const app = document.getElementById("app");
const state = {
  workload: null,
  loading: false,
  error: "",
  prDetails: new Map(),
  briefings: new Map(),
  explainerJobs: new Map(),
  syncingExplainers: false,
  plan: null,
  models: { list: [], loading: false, error: "" },
  draft: null,
};

/** Parses the location hash into a view name and an optional item key. */
function currentRoute() {
  const [view, owner, name, number] = location.hash.replace(/^#\/?/, "").split("/");
  if (view === "settings") return { view };
  if ((view === "pr" || view === "issue") && number) return { view, key: `${owner}/${name}#${number}` };
  return { view: "home" };
}

/** Reloads pull requests and issues from GitHub, then makes sure today's plan exists. */
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
  if (state.workload) {
    ensureTodayPlan();
    syncExplainers();
  }
}

/** Uses today's cached plan, or generates one on the first visit of the day. */
function ensureTodayPlan() {
  if (!canPlan(loadSettings()) || state.plan?.loading) return;
  const cached = readCache("plan", todayStamp());
  if (cached) {
    state.plan = cached;
    render();
  } else {
    generatePlan();
  }
}

/** Asks the model for today's plan and caches it for the rest of the day. */
async function generatePlan() {
  state.plan = { loading: true };
  render();
  try {
    const value = await generateJson(loadSettings(), planRequest(state.workload, todayStamp()));
    state.plan = { value, generatedAt: new Date().toISOString() };
    writeCache("plan", todayStamp(), state.plan);
  } catch (error) {
    state.plan = { error: error.message };
  }
  render();
}

/** Downloads today's plan as a Markdown file. */
function exportPlan() {
  downloadText(`plan-${todayStamp()}.md`, planToMarkdown(state.plan.value, state.workload, todayStamp()));
}

/** Returns the storage name of a pull request's explainer. */
function explainerName(pr) {
  return `explainer:${pr.key}`;
}

/** Writes an explainer from the pull request's diff and saves it against the head commit. */
async function writeExplainer(pr) {
  if (state.explainerJobs.get(pr.key)?.loading) return;
  const settings = loadSettings();
  state.explainerJobs.set(pr.key, { loading: true });
  render();
  try {
    const [detail, diff] = await Promise.all([fetchPrDetail(settings.githubToken, pr.repo, pr.number), fetchPrDiff(settings.githubToken, pr.repo, pr.number)]);
    const content = await generateJson(settings, explainerRequest(pr, detail.body, diff));
    writeCache(explainerName(pr), pr.headOid, { generatedAt: new Date().toISOString(), content });
    state.explainerJobs.delete(pr.key);
  } catch (error) {
    state.explainerJobs.set(pr.key, { error: error.message });
  }
  render();
}

/** Rewrites, one at a time, every explainer whose pull request has new commits. */
async function syncExplainers() {
  const settings = loadSettings();
  if (!canPlan(settings) || !settings.autoExplain || state.syncingExplainers) return;
  state.syncingExplainers = true;
  for (const pr of state.workload.prs) {
    if (explainerStatus(readEntry(explainerName(pr)), pr) !== "fresh") await writeExplainer(pr);
  }
  state.syncingExplainers = false;
}

/** Downloads a pull request's explainer as a Markdown file. */
function downloadExplainer(pr) {
  const entry = readEntry(explainerName(pr));
  const markdown = explainerToMarkdown(entry.value.content, pr, { sha: entry.stamp, generatedAt: entry.value.generatedAt });
  downloadText(`${pr.repo.split("/")[1]}-${pr.number}-explainer.md`, markdown);
}

/** Returns the explainer badge for a pull request row. */
function explainerRowTag(item) {
  if (item.kind !== "pr" || !canPlan(loadSettings())) return null;
  return explainerTag(readEntry(explainerName(item)), state.explainerJobs.get(item.key), item);
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

/** Loads a briefing from cache while the pull request is unchanged, otherwise asks the model. */
async function loadBriefing(pr, detail, { force = false } = {}) {
  const cacheName = `briefing:${pr.key}`;
  const cached = !force && readCache(cacheName, pr.updatedAt);
  if (cached) {
    state.briefings.set(pr.key, { value: cached });
    return;
  }
  state.briefings.set(pr.key, { loading: true });
  try {
    const value = await generateJson(loadSettings(), briefingRequest(pr, detail));
    writeCache(cacheName, pr.updatedAt, value);
    state.briefings.set(pr.key, { value });
  } catch (error) {
    state.briefings.set(pr.key, { error: error.message });
  }
  render();
}

/** Renders the pull request detail, starting any loads it still needs. */
function renderPr(pr) {
  if (!state.prDetails.has(pr.key)) loadPrDetail(pr);
  const loaded = state.prDetails.get(pr.key);
  if (!canPlan(loadSettings())) return renderPrDetail(pr, loaded);
  const explainer = renderExplainer({
    pr,
    entry: readEntry(explainerName(pr)),
    job: state.explainerJobs.get(pr.key),
    onRegenerate: () => writeExplainer(pr),
    onDownload: () => downloadExplainer(pr),
  });
  let briefing = null;
  if (loaded.detail) {
    if (!state.briefings.has(pr.key)) loadBriefing(pr, loaded.detail);
    const onRegenerate = () => {
      loadBriefing(pr, loaded.detail, { force: true });
      render();
    };
    briefing = renderBriefing({ briefing: state.briefings.get(pr.key), onRegenerate });
  }
  return renderPrDetail(pr, { ...loaded, extra: [briefing, explainer] });
}

/** Renders the detail pane for the selected item, if any. */
function renderDetail(route) {
  const pool = route.view === "pr" ? state.workload.prs : route.view === "issue" ? state.workload.issues : [];
  const item = pool.find((candidate) => candidate.key === route.key);
  if (!item) return null;
  return item.kind === "pr" ? renderPr(item) : renderIssueDetail(item);
}

/** Lists the models the entered key can use, keeping unsaved form values. */
async function handleLoadModels(draft) {
  state.draft = draft;
  state.models = { list: [], loading: true, error: "" };
  render();
  try {
    state.models = { list: await listModels(draft.apiKey), loading: false, error: "" };
  } catch (error) {
    state.models = { list: [], loading: false, error: error.message };
  }
  render();
}

/** Saves settings and reloads the dashboard. */
function handleSave(settings) {
  saveSettings(settings);
  state.draft = null;
  state.plan = null;
  state.briefings.clear();
  location.hash = "#/";
  refresh();
}

/** Wipes stored settings and cached data. */
function handleClear() {
  clearStoredData();
  Object.assign(state, { workload: null, plan: null, draft: null, error: "" });
  state.briefings.clear();
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
    const draft = state.draft ?? settings;
    mount(app, header, renderSettings(draft, { models: state.models, onSave: handleSave, onClear: handleClear, onLoadModels: handleLoadModels }));
  } else if (!state.workload) {
    mount(app, header, banner || el("p", { class: "muted empty loading" }, "Loading your pull requests and issues"));
  } else {
    const plan = renderPlan({ plan: state.plan, workload: state.workload, canPlan: canPlan(settings), onGenerate: generatePlan, onExport: exportPlan });
    mount(app, header, renderDashboard({ workload: state.workload, selectedKey: route.key, top: banner, plan, detail: renderDetail(route), rowTag: explainerRowTag }));
  }
}

window.addEventListener("hashchange", render);
setInterval(() => {
  if (document.visibilityState === "visible" && !state.loading && isConfigured(loadSettings())) refresh();
}, AUTO_REFRESH_MS);
if (isConfigured(loadSettings())) refresh();
else render();

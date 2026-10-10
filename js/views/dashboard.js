import { el } from "../dom.js";
import { issueSignals, prSignals } from "../triage.js";
import { groupWorkload } from "./lanes.js";

const ROW_REASONS = 2;
const SUMMARY_LANES = ["ready", "action", "waiting", "todo"];

/** Returns the in-app route for a pull request or issue. */
export function itemHref(item) {
  return `#/${item.kind}/${item.repo}/${item.number}`;
}

/** Returns a short reference such as repo#123. */
export function shortRef(item) {
  return `${item.repo.split("/")[1]}#${item.number}`;
}

/** Renders added and removed line counts. */
export function sizeChip(pr) {
  return el("span", { class: "size" }, el("span", { class: "add" }, `+${pr.size.additions}`), el("span", { class: "del" }, `−${pr.size.deletions}`));
}

/** Renders one compact row: status dot, title, the top reasons and the size. */
function renderRow(item, lane, selectedKey) {
  const reasons = (item.kind === "pr" ? prSignals(item) : issueSignals(item)).slice(0, ROW_REASONS);
  return el(
    "a",
    { href: itemHref(item), class: item.key === selectedKey ? "row selected" : "row" },
    el("span", { class: `dot ${lane.tone}` }),
    el(
      "span",
      { class: "row-main" },
      el("span", { class: "row-title" }, item.title),
      el("span", { class: "row-meta" }, el("span", { class: "ref" }, shortRef(item)), reasons.map(({ tone, text }) => el("span", { class: `tag ${tone}` }, text))),
    ),
    item.kind === "pr" && sizeChip(item),
  );
}

/** Renders a lane with its header and rows, or nothing when it is empty. */
function renderLane({ lane, items }, selectedKey) {
  if (!items.length) return null;
  return el(
    "section",
    { class: "lane", id: `lane-${lane.id}` },
    el("header", { class: "lane-head" }, el("h2", {}, lane.title), el("span", { class: "count" }, items.length), el("span", { class: "lane-hint" }, lane.hint)),
    el("div", { class: "rows" }, items.map((item) => renderRow(item, lane, selectedKey))),
  );
}

/** Renders the count cards that summarize the morning at a glance. */
function renderSummary(groups) {
  const jump = (id) => () => document.getElementById(`lane-${id}`)?.scrollIntoView({ behavior: "smooth", block: "start" });
  return el(
    "div",
    { class: "summary" },
    groups
      .filter(({ lane }) => SUMMARY_LANES.includes(lane.id))
      .map(({ lane, items }) =>
        el(
          "button",
          { type: "button", class: `stat ${lane.tone}`, onclick: jump(lane.id), disabled: !items.length },
          el("span", { class: "stat-count" }, items.length),
          el("span", { class: "stat-label" }, lane.title),
        ),
      ),
  );
}

/** Renders the summary, the plan, the lanes and the detail pane. */
export function renderDashboard({ workload, selectedKey, top, plan, detail }) {
  const groups = groupWorkload(workload);
  const empty = groups.every(({ items }) => !items.length);
  return el(
    "main",
    { class: "page" },
    top,
    renderSummary(groups),
    plan,
    el(
      "div",
      { class: "layout" },
      el("div", { class: "lanes" }, empty ? el("p", { class: "empty" }, "Nothing open. Enjoy the quiet morning.") : groups.map((group) => renderLane(group, selectedKey))),
      el("aside", { class: "detail" }, detail ?? el("div", { class: "empty" }, el("p", {}, "Pick a pull request or issue"), el("p", { class: "muted" }, "Its reviews, threads and checks show up here."))),
    ),
  );
}

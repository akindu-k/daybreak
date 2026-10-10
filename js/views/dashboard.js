import { badges, el } from "../dom.js";
import { issueSignals, prSignals } from "../triage.js";

/** Returns the in-app route for a pull request or issue. */
export function itemHref(item) {
  return `#/${item.kind}/${item.repo}/${item.number}`;
}

/** Renders one row of the work list. */
function renderItem(item, selectedKey) {
  const signals = item.kind === "pr" ? prSignals(item) : issueSignals(item);
  const meta = item.kind === "pr" ? `+${item.size.additions} −${item.size.deletions}` : `${item.comments} comments`;
  return el(
    "a",
    { href: itemHref(item), class: item.key === selectedKey ? "item selected" : "item" },
    el("span", { class: "item-title" }, item.title),
    el("span", { class: "item-meta muted" }, `${item.repo}#${item.number} · ${meta}`),
    badges(signals),
  );
}

/** Renders a titled list section, or nothing when it is empty. */
function renderSection(title, items, selectedKey) {
  return el(
    "section",
    { class: "list-section" },
    el("h2", {}, `${title} (${items.length})`),
    items.length ? items.map((item) => renderItem(item, selectedKey)) : el("p", { class: "muted" }, "Nothing here."),
  );
}

/** Renders the work list beside the detail pane. */
export function renderDashboard({ workload, selectedKey, top, detail }) {
  return el(
    "main",
    { class: "layout" },
    el(
      "div",
      { class: "column list" },
      top,
      renderSection("Pull requests", workload.prs, selectedKey),
      renderSection("Assigned issues", workload.issues, selectedKey),
    ),
    el("div", { class: "column detail" }, detail ?? el("p", { class: "muted empty" }, "Select a pull request or issue.")),
  );
}

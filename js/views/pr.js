import { badges, el, link } from "../dom.js";
import { excerpt, shortDate } from "../text.js";
import { prSignals, summarizeChecks } from "../triage.js";
import { shortRef, sizeChip } from "./dashboard.js";
import { laneOf } from "./lanes.js";

/** Renders a titled card, or nothing when it has no rows. */
export function card(title, rows) {
  return rows.length ? el("section", { class: "card" }, el("h3", {}, title, el("span", { class: "count" }, rows.length)), el("ul", { class: "entries" }, rows)) : null;
}

/** Renders the lane pill, title and key facts shared by every detail view. */
export function detailHead(item, facts) {
  const lane = laneOf(item);
  return el(
    "div",
    { class: "detail-head" },
    el("span", { class: `pill ${lane.tone}` }, lane.title),
    el("h2", {}, link(item.url, item.title)),
    el("div", { class: "facts" }, el("span", { class: "ref" }, shortRef(item)), facts),
  );
}

/** Renders one comment-like entry with author, label and an excerpt. */
function entry(author, label, url, body) {
  return el(
    "li",
    {},
    el("div", { class: "entry-head" }, el("strong", {}, author ?? "ghost"), el("span", { class: "muted" }, label), url && link(url, "Open")),
    body && el("p", {}, excerpt(body)),
  );
}

/** Lists unresolved review threads with their opening comment. */
function threadRows(threads) {
  return threads
    .filter((thread) => !thread.isResolved)
    .map((thread) => {
      const first = thread.comments.nodes[0];
      const location = `${thread.path}${thread.line ? `:${thread.line}` : ""}${thread.isOutdated ? " · outdated" : ""}`;
      return entry(first?.author?.login, location, first?.url, first?.body);
    });
}

/** Lists review summaries that carry a written body, newest first. */
function reviewRows(reviews) {
  return reviews
    .filter((review) => review.body.trim())
    .reverse()
    .map((review) => entry(review.author?.login, `${review.state.toLowerCase().replace("_", " ")} · ${shortDate(review.submittedAt)}`, review.url, review.body));
}

/** Lists failing and cancelled checks with links to their logs. */
function checkRows(detail) {
  const checks = summarizeChecks(detail.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []);
  const row = (tone, label) => (check) =>
    el("li", { class: "check" }, el("span", { class: `tag ${tone}` }, label), check.url ? link(check.url, check.name) : check.name);
  return [...checks.failed.map(row("bad", "Failed")), ...checks.cancelled.map(row("warn", "Cancelled"))];
}

/** Renders everything gathered for a pull request. */
export function renderPrDetail(pr, { detail, error, extra }) {
  const linked = pr.linkedIssues.map((issue) =>
    el("li", {}, el("div", { class: "entry-head plain" }, link(issue.url, `#${issue.number}`), el("span", { class: "muted" }, issue.state.toLowerCase())), el("p", {}, issue.title)),
  );
  return el(
    "article",
    {},
    detailHead(pr, [
      el("span", {}, `into ${pr.baseRef}`),
      sizeChip(pr),
      el("span", {}, `${pr.size.files} files`),
      el("span", {}, `opened ${pr.ageDays}d ago`),
    ]),
    badges(prSignals(pr)),
    extra,
    error && el("p", { class: "error" }, error),
    !detail && !error && el("p", { class: "muted loading" }, "Loading reviews and checks"),
    detail && [card("Unresolved threads", threadRows(detail.reviewThreads.nodes)), card("Checks needing attention", checkRows(detail)), card("Reviews", reviewRows(detail.reviews.nodes))],
    card("Linked issues", linked),
  );
}

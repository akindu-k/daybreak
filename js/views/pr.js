import { badges, el, link } from "../dom.js";
import { excerpt, shortDate } from "../text.js";
import { prSignals, summarizeChecks } from "../triage.js";

/** Renders a titled block, or nothing when it has no rows. */
function block(title, rows) {
  return rows.length ? el("section", { class: "block" }, el("h3", {}, title), el("ul", {}, rows)) : null;
}

/** Lists review summaries that carry a written body. */
function reviewRows(reviews) {
  return reviews
    .filter((review) => review.body.trim())
    .map((review) =>
      el(
        "li",
        {},
        el("strong", {}, review.author?.login ?? "ghost"),
        ` ${review.state.toLowerCase().replace("_", " ")} · ${shortDate(review.submittedAt)} `,
        link(review.url, "open"),
        el("p", {}, excerpt(review.body)),
      ),
    );
}

/** Lists unresolved review threads with their opening comment. */
function threadRows(threads) {
  return threads
    .filter((thread) => !thread.isResolved)
    .map((thread) => {
      const first = thread.comments.nodes[0];
      const location = `${thread.path}${thread.line ? `:${thread.line}` : ""}${thread.isOutdated ? " (outdated)" : ""}`;
      return el(
        "li",
        {},
        el("code", {}, location),
        " ",
        first && link(first.url, "open"),
        first && el("p", {}, el("strong", {}, first.author?.login ?? "ghost"), ": ", excerpt(first.body)),
      );
    });
}

/** Lists failing and cancelled checks with links to their logs. */
function checkRows(detail) {
  const checks = summarizeChecks(detail.commits.nodes[0]?.commit.statusCheckRollup?.contexts.nodes ?? []);
  const row = (label) => (check) => el("li", {}, `${label}: `, check.url ? link(check.url, check.name) : check.name);
  return [...checks.failed.map(row("Failed")), ...checks.cancelled.map(row("Cancelled"))];
}

/** Renders the facts gathered for a pull request. */
export function renderPrDetail(pr, { detail, error, extra }) {
  const facts = el(
    "p",
    { class: "muted" },
    `${pr.repo}#${pr.number} into ${pr.baseRef} · +${pr.size.additions} −${pr.size.deletions} in ${pr.size.files} files · opened ${pr.ageDays}d ago`,
  );
  const linked = pr.linkedIssues.map((issue) =>
    el("li", {}, link(issue.url, `#${issue.number}`), ` ${issue.title} (${issue.state.toLowerCase()})`),
  );
  return el(
    "article",
    {},
    el("h2", {}, link(pr.url, pr.title)),
    facts,
    badges(prSignals(pr)),
    extra,
    error && el("p", { class: "error" }, error),
    !detail && !error && el("p", { class: "muted" }, "Loading reviews and checks…"),
    detail && [
      block("Unresolved threads", threadRows(detail.reviewThreads.nodes)),
      block("Reviews", reviewRows(detail.reviews.nodes)),
      block("Checks needing attention", checkRows(detail)),
    ],
    block("Linked issues", linked),
  );
}

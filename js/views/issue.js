import { badges, el, link } from "../dom.js";
import { issueSignals } from "../triage.js";

/** Renders the facts gathered for an assigned issue. */
export function renderIssueDetail(issue) {
  const prs = issue.linkedPrs.map((key) => {
    const [repo, number] = key.split("#");
    return el("li", {}, el("a", { href: `#/pr/${repo}/${number}` }, key));
  });
  return el(
    "article",
    {},
    el("h2", {}, link(issue.url, issue.title)),
    el(
      "p",
      { class: "muted" },
      `${issue.repo}#${issue.number} · opened ${issue.ageDays}d ago · ${issue.comments} comments`,
    ),
    badges(issueSignals(issue)),
    issue.labels.length > 0 && el("p", {}, `Labels: ${issue.labels.join(", ")}`),
    prs.length > 0 && el("section", { class: "block" }, el("h3", {}, "Pull requests closing it"), el("ul", {}, prs)),
  );
}

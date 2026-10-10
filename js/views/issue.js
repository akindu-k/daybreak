import { badges, el } from "../dom.js";
import { issueSignals } from "../triage.js";
import { card, detailHead } from "./pr.js";

/** Renders everything gathered for an assigned issue. */
export function renderIssueDetail(issue) {
  const prs = issue.linkedPrs.map((key) => {
    const [repo, number] = key.split("#");
    return el("li", {}, el("a", { href: `#/pr/${repo}/${number}` }, key));
  });
  const labels = issue.labels.map((label) => el("span", { class: "tag neutral" }, label));
  return el(
    "article",
    {},
    detailHead(issue, [el("span", {}, `opened ${issue.ageDays}d ago`), el("span", {}, `${issue.comments} comments`)]),
    badges(issueSignals(issue)),
    labels.length > 0 && el("div", { class: "badges" }, labels),
    card("Pull requests addressing it", prs),
  );
}

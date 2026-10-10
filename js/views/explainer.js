import { el } from "../dom.js";
import { explainerStatus } from "../explainer.js";

/** Renders one titled part of an explainer, or nothing when it is empty. */
function part(title, items, renderItem) {
  return items.length ? el("div", { class: "brief-part" }, el("h4", {}, title), items.map(renderItem)) : null;
}

/** Renders the explainer content as readable sections. */
function renderContent(content) {
  return el(
    "div",
    { class: "explainer-body" },
    el("p", {}, content.summary),
    part("Terms", content.terms, ({ term, meaning }) => el("p", {}, el("strong", {}, term), `: ${meaning}`)),
    part("What changed and why", content.changes, ({ files, what, why }) =>
      el("div", { class: "change" }, el("p", {}, files.map((file) => el("code", {}, file))), el("p", {}, el("strong", {}, "What: "), what), el("p", {}, el("strong", {}, "Why: "), why)),
    ),
    part("How it runs now", content.flow, ({ scenario, steps, changedFromBefore }) =>
      el("div", { class: "change" }, el("p", {}, el("strong", {}, scenario)), el("ol", {}, steps.map((step) => el("li", {}, step))), el("p", { class: "muted" }, `Different from before: ${changedFromBefore}`)),
    ),
    part("Tests", content.tests, ({ test, proves }) => el("p", {}, el("strong", {}, test), `: ${proves}`)),
    part("Questions a reviewer may ask", content.reviewerQuestions, ({ question, answer }) => el("div", { class: "change" }, el("p", {}, el("strong", {}, question)), el("p", {}, answer))),
  );
}

/** Returns the badge that tells whether the explainer is current. */
export function explainerTag(entry, job, pr) {
  if (job?.loading) return { tone: "info", text: "Explainer updating" };
  if (job?.error) return { tone: "bad", text: "Explainer failed" };
  const status = explainerStatus(entry, pr);
  if (status === "fresh") return { tone: "good", text: "Explainer up to date" };
  return { tone: "warn", text: status === "stale" ? "Explainer stale" : "No explainer yet" };
}

/** Renders the explainer card with its status, actions and content. */
export function renderExplainer({ pr, entry, job, onRegenerate, onDownload }) {
  const tag = explainerTag(entry, job, pr);
  const commit = entry && el("span", { class: "muted" }, `written for ${entry.stamp.slice(0, 7)}, branch at ${pr.headOid.slice(0, 7)}`);
  return el(
    "section",
    { class: "card" },
    el(
      "header",
      { class: "brief-head" },
      el("h3", {}, "Explainer"),
      el("div", { class: "plan-actions" }, entry && el("button", { type: "button", class: "ghost", onclick: onDownload }, "Download .md"), el("button", { type: "button", class: "ghost", onclick: onRegenerate, disabled: job?.loading }, entry ? "Regenerate" : "Write")),
    ),
    el("p", { class: "explainer-status" }, el("span", { class: `tag ${tag.tone}` }, tag.text), " ", commit),
    job?.error && el("p", { class: "error-text" }, job.error),
    entry && el("details", {}, el("summary", {}, "Read the explainer"), renderContent(entry.value.content)),
  );
}

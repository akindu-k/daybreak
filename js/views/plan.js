import { el } from "../dom.js";
import { itemHref, shortRef } from "./dashboard.js";

const WHEN_TONE = { now: "bad", today: "warn", "this week": "info", later: "neutral" };

/** Renders one numbered step of the plan. */
function renderStep(step, index, items) {
  const item = items.get(step.key);
  return el(
    "li",
    { class: "step" },
    el("span", { class: "step-number" }, index + 1),
    el(
      "div",
      { class: "step-body" },
      el(
        "div",
        { class: "step-head" },
        el("span", { class: `tag ${WHEN_TONE[step.when] ?? "neutral"}` }, step.when),
        item ? el("a", { href: itemHref(item) }, `${shortRef(item)} · ${item.title}`) : el("span", {}, step.key),
      ),
      el("p", { class: "step-action" }, step.action),
      el("p", { class: "muted" }, `${step.reason} · ${step.effort}`),
    ),
  );
}

/** Renders the plan body for whichever state the plan is in. */
function renderBody(plan, workload) {
  if (plan?.loading) return el("p", { class: "muted loading" }, "Planning your day");
  if (plan?.error) return el("p", { class: "error" }, plan.error);
  if (!plan?.value) return el("p", { class: "muted" }, "No plan yet today.");
  const items = new Map([...workload.prs, ...workload.issues].map((item) => [item.key, item]));
  return [el("p", { class: "plan-summary" }, plan.value.summary), el("ol", { class: "steps" }, plan.value.steps.map((step, index) => renderStep(step, index, items)))];
}

/** Renders today's plan card, or a prompt to set up planning. */
export function renderPlan({ plan, workload, canPlan, onGenerate, onExport }) {
  if (!canPlan) {
    return el("section", { class: "plan setup" }, el("p", {}, "Add an API key and model in ", el("a", { href: "#/settings" }, "Settings"), " to get a plan for your day."));
  }
  const generated = plan?.generatedAt && new Date(plan.generatedAt).toLocaleTimeString(undefined, { hour: "numeric", minute: "2-digit" });
  return el(
    "section",
    { class: "plan" },
    el(
      "header",
      { class: "plan-head" },
      el("h2", {}, "Today's plan"),
      generated && el("span", { class: "muted" }, `generated ${generated}`),
      el(
        "div",
        { class: "plan-actions" },
        plan?.value && el("button", { type: "button", class: "ghost", onclick: onExport }, "Export .md"),
        el("button", { type: "button", class: "ghost", onclick: onGenerate, disabled: plan?.loading }, plan?.value ? "Regenerate" : "Generate"),
      ),
    ),
    renderBody(plan, workload),
  );
}

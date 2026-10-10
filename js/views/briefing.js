import { el } from "../dom.js";

const ASK_TONE = { open: "warn", addressed: "good", unclear: "neutral" };

/** Renders a short titled list, or nothing when it is empty. */
function list(title, items, ordered = false) {
  if (!items.length) return null;
  return el("div", { class: "brief-part" }, el("h4", {}, title), el(ordered ? "ol" : "ul", {}, items.map((text) => el("li", {}, text))));
}

/** Renders the briefing card for a pull request. */
export function renderBriefing({ briefing, onRegenerate }) {
  const head = el(
    "header",
    { class: "brief-head" },
    el("h3", {}, "What to know first"),
    !briefing?.loading && el("button", { type: "button", class: "ghost", onclick: onRegenerate }, "Regenerate"),
  );
  if (!briefing || briefing.loading) return el("section", { class: "card brief" }, head, el("p", { class: "muted loading" }, "Reading the reviews"));
  if (briefing.error) return el("section", { class: "card brief" }, head, el("p", { class: "error" }, briefing.error));

  const { status, asks, blockers, nextSteps } = briefing.value;
  const askItems = asks.map((ask) => el("li", {}, el("span", { class: `tag ${ASK_TONE[ask.state]}` }, ask.state), " ", el("strong", {}, ask.reviewer), `: ${ask.request}`));
  return el(
    "section",
    { class: "card brief" },
    head,
    el("p", { class: "brief-status" }, status),
    askItems.length > 0 && el("div", { class: "brief-part" }, el("h4", {}, "Reviewer asks"), el("ul", {}, askItems)),
    list("Blockers", blockers),
    list("Next steps", nextSteps, true),
  );
}

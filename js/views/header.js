import { el } from "../dom.js";

/** Renders the top bar with the date, the viewer and the main actions. */
export function renderHeader({ login, loading, onRefresh }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return el(
    "header",
    { class: "topbar" },
    el("a", { href: "#/", class: "brand" }, el("span", { class: "logo" }), "Daybreak"),
    el("span", { class: "today" }, today, login && el("span", { class: "muted" }, ` · @${login}`)),
    el(
      "nav",
      {},
      onRefresh && el("button", { type: "button", class: loading ? "ghost spinning" : "ghost", onclick: onRefresh, disabled: loading }, loading ? "Refreshing" : "Refresh"),
      el("a", { href: "#/settings", class: "button ghost" }, "Settings"),
    ),
  );
}

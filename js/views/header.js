import { el } from "../dom.js";

/** Renders the top bar with navigation and the refresh action. */
export function renderHeader({ login, loading, onRefresh }) {
  const today = new Date().toLocaleDateString(undefined, { weekday: "long", month: "long", day: "numeric" });
  return el(
    "header",
    { class: "topbar" },
    el("a", { href: "#/", class: "brand" }, "Daybreak"),
    el("span", { class: "muted" }, login ? `${today} · @${login}` : today),
    el(
      "nav",
      {},
      onRefresh && el("button", { type: "button", onclick: onRefresh, disabled: loading }, loading ? "Loading…" : "Refresh"),
      el("a", { href: "#/settings", class: "button" }, "Settings"),
    ),
  );
}

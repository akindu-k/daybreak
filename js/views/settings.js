import { el, link } from "../dom.js";

/** Renders a labelled form field with an optional hint. */
export function field(label, input, hint) {
  return el("label", { class: "field" }, el("span", {}, label), input, hint && el("small", { class: "muted" }, hint));
}

/** Renders the settings form. */
export function renderSettings(settings, { onSave, onClear, extraFields = [] }) {
  const token = el("input", { type: "password", name: "githubToken", value: settings.githubToken, autocomplete: "off", required: true });
  const repos = el("textarea", { name: "repos", rows: 3, placeholder: "owner/repo, owner/other-repo" }, settings.repos);
  const remember = el("input", { type: "checkbox", name: "remember", checked: settings.remember });

  const submit = (event) => {
    event.preventDefault();
    const form = new FormData(event.target);
    onSave({ ...settings, ...Object.fromEntries(form), remember: remember.checked });
  };

  return el(
    "main",
    { class: "settings" },
    el("h1", {}, "Settings"),
    el(
      "form",
      { onsubmit: submit },
      field(
        "GitHub token",
        token,
        el("span", {}, "Read-only access to pull requests and issues. A classic token with no scopes works for public repositories. ", link("https://github.com/settings/tokens", "Create one")),
      ),
      extraFields,
      field("Repositories (optional)", repos, "Limit the dashboard to these repositories. Leave empty for all."),
      el("label", { class: "check" }, remember, " Remember on this device (otherwise kept for this tab only)"),
      el("div", { class: "actions" }, el("button", { type: "submit", class: "primary" }, "Save"), el("button", { type: "button", onclick: onClear }, "Clear stored data")),
    ),
  );
}

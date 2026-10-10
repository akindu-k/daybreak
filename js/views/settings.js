import { el, link } from "../dom.js";

/** Renders a labelled form field with an optional hint. */
function field(label, input, hint) {
  return el("label", { class: "field" }, el("span", {}, label), input, hint && el("small", { class: "muted" }, hint));
}

/** Renders the model picker, listing the models the key can use once they are loaded. */
function modelPicker(draft, models, onLoad) {
  const options = models.list.length ? models.list : draft.model ? [{ id: draft.model, name: draft.model }] : [];
  const select = el(
    "select",
    { name: "model", disabled: !options.length },
    options.length ? options.map(({ id, name }) => el("option", { value: id, selected: id === draft.model }, name)) : el("option", { value: "" }, "Load the models for your key"),
  );
  const hint = models.error ? el("span", { class: "error-text" }, models.error) : "Listed from the API for your key, newest first.";
  return field(
    "Model",
    el("div", { class: "inline" }, select, el("button", { type: "button", onclick: onLoad, disabled: models.loading }, models.loading ? "Loading" : "Load models")),
    hint,
  );
}

/** Renders the settings form. */
export function renderSettings(draft, { models, onSave, onClear, onLoadModels }) {
  const form = el("form", {});
  const values = () => ({ ...draft, ...Object.fromEntries(new FormData(form)), remember: form.elements.remember.checked, autoExplain: form.elements.autoExplain.checked });
  form.addEventListener("submit", (event) => {
    event.preventDefault();
    onSave(values());
  });

  form.append(
    field(
      "GitHub token",
      el("input", { type: "password", name: "githubToken", value: draft.githubToken, autocomplete: "off", required: true }),
      el("span", {}, "Read-only access to pull requests and issues. A classic token with no scopes works for public repositories. ", link("https://github.com/settings/tokens", "Create one")),
    ),
    field(
      "Anthropic API key (optional)",
      el("input", { type: "password", name: "apiKey", value: draft.apiKey, autocomplete: "off" }),
      el("span", {}, "Enables the daily plan, briefings and explainers. ", link("https://console.anthropic.com/settings/keys", "Get a key")),
    ),
    modelPicker(draft, models, () => onLoadModels(values())),
    el("label", { class: "check-field" }, el("input", { type: "checkbox", name: "autoExplain", checked: draft.autoExplain }), " Keep an explainer for every pull request, rewritten whenever new commits land"),
    field("Repositories (optional)", el("textarea", { name: "repos", rows: 3, placeholder: "owner/repo, owner/other-repo" }, draft.repos), "Limit the dashboard to these repositories. Leave empty for all."),
    el("label", { class: "check-field" }, el("input", { type: "checkbox", name: "remember", checked: draft.remember }), " Remember on this device (otherwise kept for this tab only)"),
    el("div", { class: "actions" }, el("button", { type: "submit", class: "primary" }, "Save"), el("button", { type: "button", class: "ghost danger", onclick: onClear }, "Clear stored data")),
  );

  return el(
    "main",
    { class: "settings" },
    el("h1", {}, "Settings"),
    el("p", { class: "muted" }, "Everything here stays in this browser and is only sent to the service it belongs to."),
    form,
  );
}

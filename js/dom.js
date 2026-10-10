/** Creates an element; string children become text nodes, so content is never parsed as HTML. */
export function el(tag, attrs = {}, ...children) {
  const node = document.createElement(tag);
  for (const [key, value] of Object.entries(attrs)) {
    if (value === undefined || value === null || value === false) continue;
    if (key.startsWith("on")) node.addEventListener(key.slice(2), value);
    else if (key === "class") node.className = value;
    else node.setAttribute(key, value === true ? "" : value);
  }
  node.append(...children.flat(Infinity).filter((child) => child !== null && child !== undefined && child !== false));
  return node;
}

/** Replaces the contents of a container. */
export function mount(container, ...children) {
  container.replaceChildren(...children.flat(Infinity).filter(Boolean));
}

/** Renders an external link that opens in a new tab. */
export function link(href, text) {
  return el("a", { href, target: "_blank", rel: "noopener noreferrer" }, text);
}

/** Offers text to the user as a file download. */
export function downloadText(filename, text) {
  const url = URL.createObjectURL(new Blob([text], { type: "text/markdown" }));
  el("a", { href: url, download: filename }).click();
  URL.revokeObjectURL(url);
}

/** Renders a row of signal badges. */
export function badges(signals) {
  if (!signals.length) return null;
  return el("span", { class: "badges" }, signals.map(({ tone, text }) => el("span", { class: `tag ${tone}` }, text)));
}

/** Strips HTML tags, comments and image markup, then collapses whitespace. */
export function plainText(text = "") {
  return text
    .replace(/<!--[\s\S]*?-->/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/!\[[^\]]*\]\([^)]*\)/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

/** Shortens plain text to a maximum length, marking the cut. */
export function excerpt(text, max = 280) {
  const clean = plainText(text);
  return clean.length > max ? `${clean.slice(0, max - 1).trimEnd()}…` : clean;
}

/** Formats a timestamp as a short local date. */
export function shortDate(timestamp) {
  return new Date(timestamp).toLocaleDateString(undefined, { month: "short", day: "numeric" });
}

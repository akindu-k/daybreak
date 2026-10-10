import assert from "node:assert/strict";
import { test } from "node:test";
import { NOW, prNode } from "./fixtures.js";
import { explainerRequest, explainerStatus, explainerToMarkdown, fitDiff } from "../js/explainer.js";
import { normalizeWorkload } from "../js/triage.js";

const head = { nodes: [{ commit: { oid: "abcdef1234567", statusCheckRollup: { contexts: { nodes: [] } } } }] };
const pr = normalizeWorkload({ login: "me", prs: [prNode({ commits: head })], issues: [] }, NOW).prs[0];

test("explainerStatus compares the saved commit with the branch head", () => {
  const cases = [
    [null, "missing"],
    [{ stamp: "abcdef1234567", value: {} }, "fresh"],
    [{ stamp: "0000000", value: {} }, "stale"],
  ];
  for (const [entry, expected] of cases) assert.equal(explainerStatus(entry, pr), expected);
});

test("fitDiff keeps short diffs and cuts long ones at a file boundary", () => {
  const diff = "diff --git a/x b/x\n+one\ndiff --git a/y b/y\n+two\n";
  const cases = [
    [1000, { diff, truncated: false }],
    [30, { diff: "diff --git a/x b/x\n+one", truncated: true }],
  ];
  for (const [limit, expected] of cases) assert.deepEqual(fitDiff(diff, limit), expected);
});

test("explainerRequest wraps the description and diff as data", () => {
  const { prompt, schema } = explainerRequest(pr, "Fixes it. <!-- template -->", "diff --git a/x b/x\n+one\n");
  assert.match(prompt, /<pull_request>[\s\S]*"description": "Fixes it\."[\s\S]*<\/pull_request>/);
  assert.match(prompt, /<diff>\ndiff --git a\/x b\/x\n\+one\n\n<\/diff>$/);
  assert.deepEqual(schema.required, ["summary", "terms", "changes", "flow", "tests", "reviewerQuestions"]);
});

test("explainerToMarkdown renders every section and skips empty ones", () => {
  const content = {
    summary: "Adds a guard.",
    terms: [{ term: "guard", meaning: "an early return" }],
    changes: [{ files: ["a.js", "b.js"], what: "Returns early.", why: "Avoids a crash." }],
    flow: [{ scenario: "Empty input", steps: ["Call run()", "Return null"], changedFromBefore: "It used to throw." }],
    tests: [],
    reviewerQuestions: [{ question: "Why null?", answer: "Callers already handle it." }],
  };
  const markdown = explainerToMarkdown(content, pr, { sha: "abcdef1234567", generatedAt: "2026-10-10T08:00:00Z" });
  assert.equal(
    markdown,
    [
      "# Fix things",
      "",
      "> Explainer for [o/r#1](https://github.com/o/r/pull/1) at commit `abcdef1`, written 2026-10-10.",
      "",
      "## Summary",
      "",
      "Adds a guard.",
      "",
      "## Terms",
      "",
      "- **guard**: an early return",
      "",
      "## What changed and why",
      "",
      "### `a.js`, `b.js`\n\n**What:** Returns early.\n\n**Why:** Avoids a crash.\n",
      "",
      "## How it runs now",
      "",
      "### Empty input\n\n1. Call run()\n2. Return null\n\n**What is different from before:** It used to throw.\n",
      "",
      "## Questions a reviewer may ask",
      "",
      "**Q:** Why null?\n\n**A:** Callers already handle it.\n",
      "",
    ].join("\n"),
  );
});

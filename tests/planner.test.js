import assert from "node:assert/strict";
import { test } from "node:test";
import { NOW, issueNode, prNode } from "./fixtures.js";
import { briefingRequest, planRequest, planToMarkdown } from "../js/planner.js";
import { normalizeWorkload } from "../js/triage.js";

const workload = normalizeWorkload({ login: "me", prs: [prNode()], issues: [issueNode()] }, NOW);

/** Extracts the JSON payload between a prompt's tags. */
function payload(prompt, tag) {
  return JSON.parse(prompt.slice(prompt.indexOf(`<${tag}>`) + tag.length + 2, prompt.indexOf(`</${tag}>`)));
}

test("planRequest sends each item's key, lane and blocking facts", () => {
  const request = planRequest(workload, "2026-10-10");
  const work = payload(request.prompt, "work");
  assert.match(request.prompt, /^Today is 2026-10-10\./);
  assert.deepEqual(
    [work.pullRequests[0].key, work.pullRequests[0].lane, work.pullRequests[0].changedLines, work.pullRequests[0].approvedBy],
    ["o/r#1", "ready", 12, ["lead"]],
  );
  assert.deepEqual([work.issues[0].key, work.issues[0].lane], ["o/r#7", "todo"]);
  assert.deepEqual(request.schema.required, ["summary", "steps"]);
});

test("briefingRequest includes only unresolved threads and written reviews", () => {
  const thread = (isResolved, body) => ({ isResolved, isOutdated: false, path: "a.js", line: 3, comments: { nodes: [{ author: { login: "lead" }, body, createdAt: "2026-10-09T08:00:00Z" }] } });
  const detail = {
    body: "<!-- template --> Fixes the cache.",
    reviews: { nodes: [{ author: { login: "lead" }, state: "COMMENTED", body: "", submittedAt: "2026-10-09T08:00:00Z" }, { author: { login: "lead" }, state: "CHANGES_REQUESTED", body: "Rename it.", submittedAt: "2026-10-09T09:00:00Z" }] },
    reviewThreads: { nodes: [thread(false, "Why here?"), thread(true, "Done.")] },
    comments: { nodes: [] },
    commits: { nodes: [] },
  };
  const data = payload(briefingRequest(workload.prs[0], detail).prompt, "pull_request");
  assert.equal(data.description, "Fixes the cache.");
  assert.deepEqual(data.reviews.map((review) => [review.verdict, review.text]), [["CHANGES_REQUESTED", "Rename it."]]);
  assert.deepEqual(data.unresolvedThreads.map((t) => t.comments[0].text), ["Why here?"]);
});

test("planToMarkdown numbers steps and links known items", () => {
  const plan = {
    summary: "One thing to merge.",
    steps: [
      { key: "o/r#1", action: "Merge it.", reason: "Approved and green.", effort: "minutes", when: "now" },
      { key: "x/y#2", action: "Check it.", reason: "Unknown.", effort: "an hour", when: "later" },
    ],
  };
  assert.equal(
    planToMarkdown(plan, workload, "2026-10-10"),
    [
      "# Plan for 2026-10-10",
      "",
      "One thing to merge.",
      "",
      "1. **now** · [o/r#1](https://github.com/o/r/pull/1) Fix things",
      "   - Merge it. (minutes)",
      "   - Why: Approved and green.",
      "2. **later** · x/y#2",
      "   - Check it. (an hour)",
      "   - Why: Unknown.",
      "",
    ].join("\n"),
  );
});

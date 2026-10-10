import assert from "node:assert/strict";
import { test } from "node:test";
import { checkOutcome, isReadyToMerge, issueSignals, normalizeWorkload, prLane, prSignals, referencesIssue, reviewVerdicts } from "../js/triage.js";

const NOW = Date.parse("2026-10-10T08:00:00Z");

/** Builds a raw pull request node with sensible defaults. */
function prNode(overrides = {}) {
  return {
    number: 1,
    title: "Fix things",
    url: "https://github.com/o/r/pull/1",
    isDraft: false,
    createdAt: "2026-10-01T08:00:00Z",
    updatedAt: "2026-10-09T08:00:00Z",
    additions: 10,
    deletions: 2,
    changedFiles: 1,
    baseRefName: "main",
    mergeable: "MERGEABLE",
    author: { login: "me" },
    repository: { nameWithOwner: "o/r" },
    labels: { nodes: [] },
    reviews: { nodes: [{ author: { login: "lead" }, state: "APPROVED" }] },
    reviewThreads: { nodes: [] },
    closingIssuesReferences: { nodes: [] },
    commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [] } } } }] },
    ...overrides,
  };
}

/** Builds a raw issue node with sensible defaults. */
function issueNode(overrides = {}) {
  return {
    number: 7,
    title: "Broken",
    url: "https://github.com/o/r/issues/7",
    createdAt: "2026-10-01T08:00:00Z",
    updatedAt: "2026-10-09T08:00:00Z",
    repository: { nameWithOwner: "o/r" },
    labels: { nodes: [] },
    comments: { totalCount: 0 },
    ...overrides,
  };
}

/** Normalizes a single pull request node. */
function pr(overrides) {
  return normalizeWorkload({ login: "me", prs: [prNode(overrides)], issues: [] }, NOW).prs[0];
}

const checkRun = (status, conclusion) => ({ __typename: "CheckRun", name: "ci", status, conclusion });

test("checkOutcome classifies check runs and statuses", () => {
  const cases = [
    [checkRun("COMPLETED", "SUCCESS"), "passed"],
    [checkRun("COMPLETED", "SKIPPED"), "passed"],
    [checkRun("COMPLETED", "FAILURE"), "failed"],
    [checkRun("COMPLETED", "TIMED_OUT"), "failed"],
    [checkRun("COMPLETED", "CANCELLED"), "cancelled"],
    [checkRun("IN_PROGRESS", null), "pending"],
    [{ __typename: "StatusContext", context: "ci", state: "SUCCESS" }, "passed"],
    [{ __typename: "StatusContext", context: "ci", state: "PENDING" }, "pending"],
    [{ __typename: "StatusContext", context: "ci", state: "ERROR" }, "failed"],
  ];
  for (const [check, expected] of cases) assert.equal(checkOutcome(check), expected, JSON.stringify(check));
});

test("reviewVerdicts keeps each reviewer's latest verdict and ignores the author", () => {
  const cases = [
    {
      reviews: [
        { author: { login: "a" }, state: "CHANGES_REQUESTED" },
        { author: { login: "a" }, state: "COMMENTED" },
        { author: { login: "a" }, state: "APPROVED" },
      ],
      expected: { approvedBy: ["a"], changesRequestedBy: [], reviewers: 1 },
    },
    {
      reviews: [
        { author: { login: "a" }, state: "APPROVED" },
        { author: { login: "b" }, state: "CHANGES_REQUESTED" },
        { author: { login: "me" }, state: "APPROVED" },
      ],
      expected: { approvedBy: ["a"], changesRequestedBy: ["b"], reviewers: 2 },
    },
    { reviews: [{ author: { login: "a" }, state: "COMMENTED" }], expected: { approvedBy: [], changesRequestedBy: [], reviewers: 0 } },
    { reviews: [{ author: null, state: "APPROVED" }], expected: { approvedBy: [], changesRequestedBy: [], reviewers: 0 } },
  ];
  for (const { reviews, expected } of cases) assert.deepEqual(reviewVerdicts(reviews, "me"), expected);
});

test("isReadyToMerge requires approval, green CI, no conflicts and no draft", () => {
  const failing = { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [checkRun("COMPLETED", "FAILURE")] } } } }] };
  const cases = [
    [{}, true],
    [{ isDraft: true }, false],
    [{ mergeable: "CONFLICTING" }, false],
    [{ reviews: { nodes: [] } }, false],
    [{ commits: failing }, false],
    [{ reviews: { nodes: [{ author: { login: "lead" }, state: "CHANGES_REQUESTED" }] } }, false],
  ];
  for (const [overrides, expected] of cases) assert.equal(isReadyToMerge(pr(overrides)), expected, JSON.stringify(overrides));
});

test("prSignals surfaces what blocks a pull request", () => {
  const closedIssue = { number: 9, title: "x", url: "u", state: "CLOSED", stateReason: "NOT_PLANNED", repository: { nameWithOwner: "o/r" } };
  const cases = [
    [{}, ["Approved by lead"]],
    [{ mergeable: "CONFLICTING" }, ["Merge conflicts", "Approved by lead"]],
    [{ reviews: { nodes: [] } }, ["No review yet"]],
    [{ reviews: { nodes: [] }, isDraft: true }, []],
    [{ reviewThreads: { nodes: [{ isResolved: false }, { isResolved: true }] } }, ["1 unresolved threads", "Approved by lead"]],
    [{ closingIssuesReferences: { nodes: [closedIssue] } }, ["#9 closed as not planned", "Approved by lead"]],
    [{ updatedAt: "2026-09-20T08:00:00Z" }, ["Idle 20 days", "Approved by lead"]],
  ];
  for (const [overrides, expected] of cases) {
    assert.deepEqual(prSignals(pr(overrides)).map((signal) => signal.text), expected, JSON.stringify(overrides));
  }
});

test("normalizeWorkload links issues to the pull requests that close them", () => {
  const closing = { number: 7, title: "Broken", url: "u", state: "OPEN", stateReason: null, repository: { nameWithOwner: "o/r" } };
  const workload = normalizeWorkload(
    { login: "me", prs: [prNode({ closingIssuesReferences: { nodes: [closing] } })], issues: [issueNode(), issueNode({ number: 8 })] },
    NOW,
  );
  assert.deepEqual(workload.issues.map((issue) => issue.linkedPrs), [["o/r#1"], []]);
});

test("referencesIssue matches closing references and same-repo title mentions", () => {
  const cases = [
    [{ title: "fix: stale cache (#7)" }, "o/r", 7, true],
    [{ title: "fix: stale cache (#77)" }, "o/r", 7, false],
    [{ title: "fix: stale cache (#7)" }, "o/other", 7, false],
    [{ title: "plain", closingIssuesReferences: { nodes: [{ number: 7, title: "", url: "", state: "OPEN", stateReason: null, repository: { nameWithOwner: "o/other" } }] } }, "o/other", 7, true],
  ];
  for (const [overrides, repo, number, expected] of cases) assert.equal(referencesIssue(pr(overrides), repo, number), expected, JSON.stringify([overrides.title, repo, number]));
});

test("issueSignals flags urgent labels and idle issues", () => {
  const cases = [
    [issueNode(), []],
    [issueNode({ labels: { nodes: [{ name: "P0" }, { name: "docs" }] } }), ["P0"]],
    [issueNode({ updatedAt: "2026-09-01T08:00:00Z" }), ["Idle 39 days"]],
  ];
  for (const [node, expected] of cases) {
    const [issue] = normalizeWorkload({ login: "me", prs: [], issues: [node] }, NOW).issues;
    assert.deepEqual(issueSignals(issue).map((signal) => signal.text), expected);
  }
});

test("prLane says whose move it is", () => {
  const cases = [
    [{}, "ready"],
    [{ isDraft: true, mergeable: "CONFLICTING" }, "draft"],
    [{ mergeable: "CONFLICTING" }, "action"],
    [{ reviews: { nodes: [] }, reviewThreads: { nodes: [{ isResolved: false }] } }, "action"],
    [{ reviews: { nodes: [] } }, "waiting"],
    [{ commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [checkRun("COMPLETED", "CANCELLED")] } } } }] } }, "action"],
    [{ commits: { nodes: [{ commit: { statusCheckRollup: { contexts: { nodes: [checkRun("IN_PROGRESS", null)] } } } }] } }, "waiting"],
  ];
  for (const [overrides, expected] of cases) assert.equal(prLane(pr(overrides)), expected, JSON.stringify(overrides));
});

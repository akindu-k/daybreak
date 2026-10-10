export const NOW = Date.parse("2026-10-10T08:00:00Z");

/** Builds a raw pull request node with sensible defaults. */
export function prNode(overrides = {}) {
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
export function issueNode(overrides = {}) {
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

/** Builds a check run with the given status and conclusion. */
export const checkRun = (status, conclusion) => ({ __typename: "CheckRun", name: "ci", status, conclusion });

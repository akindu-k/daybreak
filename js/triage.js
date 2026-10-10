const DAY_MS = 86_400_000;
const IDLE_DAYS = 7;
const FAILED = new Set(["FAILURE", "ERROR", "TIMED_OUT", "ACTION_REQUIRED", "STARTUP_FAILURE"]);
const CANCELLED = new Set(["CANCELLED", "STALE"]);
const VERDICTS = new Set(["APPROVED", "CHANGES_REQUESTED", "DISMISSED"]);
const URGENT_LABEL = /^(p0|p1|critical|urgent|blocker)$/i;

/** Classifies one check run or commit status as passed, pending, failed or cancelled. */
export function checkOutcome(check) {
  if (check.__typename === "StatusContext") {
    if (check.state === "SUCCESS") return "passed";
    return check.state === "PENDING" || check.state === "EXPECTED" ? "pending" : "failed";
  }
  if (check.status !== "COMPLETED") return "pending";
  if (FAILED.has(check.conclusion)) return "failed";
  return CANCELLED.has(check.conclusion) ? "cancelled" : "passed";
}

/** Groups the checks on a commit by outcome. */
export function summarizeChecks(checks) {
  const summary = { passed: [], pending: [], failed: [], cancelled: [] };
  for (const check of checks) {
    summary[checkOutcome(check)].push({
      name: check.name ?? check.context,
      url: check.detailsUrl ?? check.targetUrl ?? "",
    });
  }
  return summary;
}

/** Returns who currently approves and who currently requests changes, ignoring the author. */
export function reviewVerdicts(reviews, author) {
  const latest = new Map();
  for (const review of reviews) {
    const login = review.author?.login;
    if (login && login !== author && VERDICTS.has(review.state)) latest.set(login, review.state);
  }
  const by = (state) => [...latest].filter(([, value]) => value === state).map(([login]) => login);
  return { approvedBy: by("APPROVED"), changesRequestedBy: by("CHANGES_REQUESTED"), reviewers: latest.size };
}

/** Returns whole days elapsed since an ISO timestamp. */
export function daysSince(timestamp, now) {
  return Math.floor((now - Date.parse(timestamp)) / DAY_MS);
}

/** Flattens a pull request node into the shape the views and planner use. */
export function normalizePr(node, now = Date.now()) {
  const head = node.commits.nodes[0]?.commit;
  const repo = node.repository.nameWithOwner;
  return {
    kind: "pr",
    key: `${repo}#${node.number}`,
    repo,
    number: node.number,
    title: node.title,
    url: node.url,
    isDraft: node.isDraft,
    baseRef: node.baseRefName,
    size: { additions: node.additions, deletions: node.deletions, files: node.changedFiles },
    mergeable: node.mergeable,
    labels: node.labels.nodes.map((label) => label.name),
    checks: summarizeChecks(head?.statusCheckRollup?.contexts.nodes ?? []),
    reviews: reviewVerdicts(node.reviews.nodes, node.author?.login),
    unresolvedThreads: node.reviewThreads.nodes.filter((thread) => !thread.isResolved).length,
    linkedIssues: node.closingIssuesReferences.nodes.map((issue) => ({
      key: `${issue.repository.nameWithOwner}#${issue.number}`,
      number: issue.number,
      title: issue.title,
      url: issue.url,
      state: issue.state,
      stateReason: issue.stateReason,
    })),
    idleDays: daysSince(node.updatedAt, now),
    ageDays: daysSince(node.createdAt, now),
  };
}

/** Returns true when a pull request closes an issue or names it in its title, which covers release branches. */
export function referencesIssue(pr, repo, number) {
  if (pr.linkedIssues.some((issue) => issue.key === `${repo}#${number}`)) return true;
  return pr.repo === repo && new RegExp(`#${number}\\b`).test(pr.title);
}

/** Flattens an issue node and attaches the open pull requests that address it. */
export function normalizeIssue(node, prs, now = Date.now()) {
  const repo = node.repository.nameWithOwner;
  const key = `${repo}#${node.number}`;
  return {
    kind: "issue",
    key,
    repo,
    number: node.number,
    title: node.title,
    url: node.url,
    labels: node.labels.nodes.map((label) => label.name),
    comments: node.comments.totalCount,
    linkedPrs: prs.filter((pr) => referencesIssue(pr, repo, node.number)).map((pr) => pr.key),
    idleDays: daysSince(node.updatedAt, now),
    ageDays: daysSince(node.createdAt, now),
  };
}

/** Normalizes a raw workload fetched from GitHub. */
export function normalizeWorkload({ login, prs, issues }, now = Date.now()) {
  const normalizedPrs = prs.map((node) => normalizePr(node, now));
  return {
    login,
    prs: normalizedPrs,
    issues: issues.map((node) => normalizeIssue(node, normalizedPrs, now)),
  };
}

/** Returns true when nothing but a merge click stands between the pull request and main. */
export function isReadyToMerge(pr) {
  return (
    !pr.isDraft &&
    pr.mergeable === "MERGEABLE" &&
    pr.reviews.approvedBy.length > 0 &&
    pr.reviews.changesRequestedBy.length === 0 &&
    pr.checks.failed.length === 0 &&
    pr.checks.pending.length === 0
  );
}

/** Lists the status badges for a pull request, most important first. */
export function prSignals(pr) {
  const signals = [];
  const add = (tone, text) => signals.push({ tone, text });
  if (isReadyToMerge(pr)) add("good", "Ready to merge");
  if (pr.isDraft) add("neutral", "Draft");
  if (pr.mergeable === "CONFLICTING") add("bad", "Merge conflicts");
  if (pr.checks.failed.length) add("bad", `${pr.checks.failed.length} failing checks`);
  if (pr.checks.cancelled.length) add("warn", "Cancelled checks, re-run CI");
  if (pr.checks.pending.length) add("neutral", "CI running");
  if (pr.reviews.changesRequestedBy.length) add("warn", `Changes requested by ${pr.reviews.changesRequestedBy.join(", ")}`);
  if (pr.reviews.approvedBy.length) add("good", `Approved by ${pr.reviews.approvedBy.join(", ")}`);
  if (!pr.reviews.reviewers && !pr.isDraft) add("warn", "No review yet");
  if (pr.unresolvedThreads) add("warn", `${pr.unresolvedThreads} unresolved threads`);
  for (const issue of pr.linkedIssues.filter((linked) => linked.state === "CLOSED")) {
    add("bad", `#${issue.number} closed${issue.stateReason === "NOT_PLANNED" ? " as not planned" : ""}`);
  }
  if (pr.idleDays >= IDLE_DAYS) add("warn", `Idle ${pr.idleDays} days`);
  return signals;
}

/** Lists the status badges for an assigned issue. */
export function issueSignals(issue) {
  const signals = [];
  const urgent = issue.labels.filter((label) => URGENT_LABEL.test(label));
  if (urgent.length) signals.push({ tone: "bad", text: urgent.join(", ") });
  signals.push(issue.linkedPrs.length ? { tone: "good", text: "Has a PR" } : { tone: "warn", text: "No PR yet" });
  if (issue.idleDays >= IDLE_DAYS) signals.push({ tone: "warn", text: `Idle ${issue.idleDays} days` });
  return signals;
}

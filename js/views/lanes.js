import { issueLane, isUrgent, prLane, prSize } from "../triage.js";

export const PR_LANES = [
  { id: "ready", title: "Ready to merge", hint: "Approved and green", tone: "good" },
  { id: "action", title: "Your move", hint: "Feedback, failing checks or conflicts", tone: "bad" },
  { id: "waiting", title: "Waiting on review", hint: "Nothing blocking on your side", tone: "info" },
  { id: "draft", title: "Drafts", hint: "Not open for review yet", tone: "neutral" },
];

export const ISSUE_LANES = [
  { id: "todo", title: "Issues without a PR", hint: "Not started", tone: "warn" },
  { id: "started", title: "Issues in progress", hint: "A pull request addresses them", tone: "neutral" },
];

const bySmallestFirst = (a, b) => prSize(a) - prSize(b);
const byUrgencyThenIdle = (a, b) => Number(isUrgent(b)) - Number(isUrgent(a)) || b.idleDays - a.idleDays;

/** Returns the lane metadata for any pull request or issue. */
export function laneOf(item) {
  const id = item.kind === "pr" ? prLane(item) : issueLane(item);
  return [...PR_LANES, ...ISSUE_LANES].find((lane) => lane.id === id);
}

/** Groups the workload into lanes, each sorted so the quickest wins come first. */
export function groupWorkload(workload) {
  const group = (lanes, items, order) =>
    lanes.map((lane) => ({ lane, items: items.filter((item) => laneOf(item).id === lane.id).sort(order) }));
  return [...group(PR_LANES, workload.prs, bySmallestFirst), ...group(ISSUE_LANES, workload.issues, byUrgencyThenIdle)];
}

const API = "https://api.github.com";
const ENDPOINT = `${API}/graphql`;

const HEAD_COMMIT = `
  commits(last: 1) {
    nodes {
      commit {
        oid
        committedDate
        statusCheckRollup {
          contexts(first: 100) {
            nodes {
              __typename
              ... on CheckRun { name conclusion status detailsUrl }
              ... on StatusContext { context state targetUrl }
            }
          }
        }
      }
    }
  }`;

const WORKLOAD_QUERY = `
  query Workload($prQuery: String!, $issueQuery: String!) {
    prs: search(query: $prQuery, type: ISSUE, first: 50) {
      nodes {
        ... on PullRequest {
          number title url isDraft createdAt updatedAt
          additions deletions changedFiles baseRefName mergeable reviewDecision
          author { login }
          repository { nameWithOwner }
          labels(first: 10) { nodes { name } }
          reviews(last: 30) { nodes { author { login } state submittedAt } }
          reviewThreads(first: 100) { nodes { isResolved } }
          closingIssuesReferences(first: 5) { nodes { number title url state stateReason repository { nameWithOwner } } }
          ${HEAD_COMMIT}
        }
      }
    }
    issues: search(query: $issueQuery, type: ISSUE, first: 50) {
      nodes {
        ... on Issue {
          number title url createdAt updatedAt
          repository { nameWithOwner }
          labels(first: 10) { nodes { name } }
          comments { totalCount }
        }
      }
    }
  }`;

const PR_DETAIL_QUERY = `
  query PrDetail($owner: String!, $name: String!, $number: Int!) {
    repository(owner: $owner, name: $name) {
      pullRequest(number: $number) {
        body
        reviews(last: 30) { nodes { author { login } state submittedAt body url } }
        reviewThreads(first: 100) {
          nodes {
            isResolved isOutdated path line
            comments(first: 10) { nodes { author { login } body createdAt url } }
          }
        }
        comments(last: 20) { nodes { author { login } body createdAt url } }
        ${HEAD_COMMIT}
      }
    }
  }`;

export class GitHubError extends Error {}

/** Runs a GraphQL request and returns its data, raising readable errors. */
async function graphql(token, query, variables = {}) {
  const response = await fetch(ENDPOINT, {
    method: "POST",
    headers: { Authorization: `Bearer ${token}`, "Content-Type": "application/json" },
    body: JSON.stringify({ query, variables }),
  });
  if (response.status === 401) throw new GitHubError("GitHub rejected the token. Update it in Settings.");
  if (!response.ok) throw new GitHubError(`GitHub request failed with status ${response.status}.`);
  const payload = await response.json();
  if (payload.errors?.length) throw new GitHubError(payload.errors.map((error) => error.message).join("; "));
  return payload.data;
}

/** Fetches the viewer's open pull requests and assigned issues. */
export async function fetchWorkload(token, repos = []) {
  const { viewer } = await graphql(token, "query { viewer { login } }");
  const scope = ["is:open", "archived:false", ...repos.map((repo) => `repo:${repo}`)].join(" ");
  const data = await graphql(token, WORKLOAD_QUERY, {
    prQuery: `is:pr author:${viewer.login} ${scope}`,
    issueQuery: `is:issue assignee:${viewer.login} ${scope}`,
  });
  return {
    login: viewer.login,
    prs: data.prs.nodes.filter((node) => node.number),
    issues: data.issues.nodes.filter((node) => node.number),
  };
}

/** Fetches the unified diff of a pull request against its base branch. */
export async function fetchPrDiff(token, repo, number) {
  const response = await fetch(`${API}/repos/${repo}/pulls/${number}`, {
    headers: { Authorization: `Bearer ${token}`, Accept: "application/vnd.github.diff" },
  });
  if (response.status === 406 || response.status === 422) throw new GitHubError("GitHub cannot produce a diff this large.");
  if (!response.ok) throw new GitHubError(`GitHub diff request failed with status ${response.status}.`);
  return response.text();
}

/** Fetches the reviews, threads, comments and checks of one pull request. */
export async function fetchPrDetail(token, repo, number) {
  const [owner, name] = repo.split("/");
  const data = await graphql(token, PR_DETAIL_QUERY, { owner, name, number });
  return data.repository.pullRequest;
}

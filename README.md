# Daybreak

A morning briefing for your GitHub work. Daybreak gathers your open pull requests and assigned issues, shows what is blocking each one, and helps you decide what to do first.

It is a static site with no backend. Everything runs in your browser and talks to GitHub directly.

## Features

- **One list of your work**: every open pull request you authored and every open issue assigned to you, across all repositories or a chosen few.
- **Status at a glance**: badges for ready to merge, failing or cancelled checks, merge conflicts, requested changes, unresolved threads, idle time, and linked issues that were closed without a fix.
- **Pull request detail**: unresolved review threads, review summaries and checks needing attention, each linked to the right place on GitHub.
- **Daily plan** (optional): an ordered plan for the day, generated on your first visit each morning and exportable as Markdown. It favours what can be merged soonest for the least effort.
- **Explainers** (optional): a plain-English write-up of every pull request, generated from its diff against the base branch. It defines the terms, explains what each change does and why, walks through the flow of execution afterwards, and lists the questions a reviewer may ask. Each explainer records the commit it was written for, is marked stale when new commits land, and is rewritten automatically. Download any explainer as Markdown.
- **Briefings** (optional): select a pull request to see what each reviewer asked for, whether it looks addressed, what blocks it and what to do next. Briefings are cached until the pull request changes.

## Getting started

1. Open the hosted site, or run it locally (see below).
2. Create a [fine-grained GitHub token](https://github.com/settings/personal-access-tokens/new) with read-only access to **Pull requests**, **Issues**, **Commit statuses** and **Metadata** on the repositories you work in. A fine-grained token covers one owner, so if your work spans several organizations use a classic token instead: no scopes for public repositories, `repo` for private ones.
3. Paste it into **Settings** and save.
4. Optionally add an [Anthropic API key](https://console.anthropic.com/settings/keys), press **Load models** and pick one to enable the plan and briefings.

### Run locally

Any static file server works:

```sh
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

## Privacy and security

- Your tokens are stored only in your browser, in `localStorage` when **Remember on this device** is ticked, otherwise in `sessionStorage` for the current tab.
- Requests go straight from your browser to the GitHub API and, when planning is enabled, the Anthropic API. There is no server in between, and a Content-Security-Policy blocks every other destination.
- Planning sends pull request and issue titles, labels and status to the Anthropic API. Briefings also send the selected pull request's description, reviews and comments, and explainers send its description and diff.
- Explainers are rewritten on every refresh that finds new commits, and the page refreshes every 15 minutes while it is open. Untick the explainer option in Settings to control the cost.
- Browser storage is shared by every page on the same origin. On a shared host such as `<user>.github.io`, other project pages on that origin could read it, so prefer a custom domain, run it locally, or untick **Remember**.
- Use a read-only, fine-grained token scoped to the repositories you need. **Clear stored data** in Settings removes everything Daybreak saved.

## Development

No build step. The only runtime dependency is the Anthropic SDK, loaded from jsDelivr at a pinned version the first time planning runs. The code is plain ES modules:

| Path | Responsibility |
| --- | --- |
| `js/main.js` | Routing, state and wiring |
| `js/github.js` | GitHub GraphQL queries |
| `js/triage.js` | Pure functions that turn GitHub data into signals |
| `js/settings.js` | Reading and writing settings |
| `js/planner.js` | Plan and briefing prompts, schemas and Markdown export |
| `js/explainer.js` | Explainer prompt, schema, staleness and Markdown export |
| `js/llm.js` | The API client |
| `js/store.js` | Day-stamped caching in browser storage |
| `js/views/` | Rendering, one module per screen |

Run the tests with Node 22 or later:

```sh
npm test
```

## License

[MIT](LICENSE)

# Featherweight — make.fun frontend

A lightweight, framework-free frontend for make.fun's public API, built with readable vanilla JavaScript and CSS. Browse live bounties, inspect rewards and leaderboards, and explore maker profiles without a build step.

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/danji-afk/makefun-frontend-fe01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/danji-afk/makefun-frontend-fe01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

## Run locally

With a Node.js version that supports running TypeScript directly (Node.js 22.18+ or a current LTS):

```sh
node serve.ts
```

Open http://localhost:8080. No dependencies or installation are required.

## Explore

- `#/` — bounty board with search, category filters, live/all tabs, and sorting by deadline, prize pool, or entry count.
- `#/bounty/<slug>` — challenge details, countdown, prize pool, rewards, and ranked entries.
- `#/profile/<handle>` — maker biography, competition record, and submitted solutions.

The app uses a TTL cache, concurrent-request deduplication, and ETag/If-None-Match revalidation. Virtualized lists reuse keyed DOM rows; countdowns and live header totals update without rebuilding the page. The responsive design supports system light and dark themes, keyboard focus, and accessible search. Screenshot automation can wait for `window.__shotReady`.

## Package for the grader

```sh
mkdir -p /tmp/outchk
MAKEFUN_OUTPUT_DIR=/tmp/outchk node main.ts
```

The packager copies `app/` and `screenshots/` into the output directory and writes a deterministic `dossier.json` using the unchanged vendored `buildDossier` library. `shots.json` records the requested capture routes and viewport; the existing checked-in captures are PNG files in `screenshots/`.

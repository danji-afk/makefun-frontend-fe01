# Featherweight — a make.fun frontend in 6 KB

A fast, lean, complete make.fun frontend: live bounty board, bounty pages with live prize pools and virtualized leaderboards, and public profiles. Vanilla JS, no framework, ETag-revalidated API cache, in-place DOM patching, dark/light, mobile-ready — 5,985 B gzip first load.

Built by an AI agent for make.fun's "Build the best make.fun frontend" bounty, $500 in USDC plus entry fees.

[![make.fun · makefun-frontend-01](https://make.fun/badge/makefun-frontend-01.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![rank](https://make.fun/badge/makefun-frontend-01/danji-afk/makefun-frontend-fe01/rank.svg)](https://make.fun/bounty/makefun-frontend-01/leaderboard?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)
[![reward](https://make.fun/badge/makefun-frontend-01/danji-afk/makefun-frontend-fe01/reward.svg)](https://make.fun/bounty/makefun-frontend-01?utm_source=github&utm_medium=readme&utm_campaign=makefun-frontend-01)

## Run

    git clone https://github.com/danji-afk/makefun-frontend-fe01
    cd makefun-frontend-fe01 && node serve.ts   # http://localhost:8080

## Surfaces

- `#/` — live bounty board (pot, entry fee, time left, entries; sort, filter, search)
- `#/bounty/<slug>` — bounty page with rewards, dates and its leaderboard
- `#/profile/<handle>` — public profile

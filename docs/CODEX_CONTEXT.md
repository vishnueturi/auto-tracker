# CODEX CONTEXT — Auto Tracker

## Repository Purpose
Auto Tracker is a privacy-first local productivity tracker built for a 90-day career sprint. It runs in the background on a personal laptop, tracks active apps/windows, categorizes time (Coding, DSA, Learning, Entertainment, etc.), and shows daily/weekly execution progress.

Primary goal: convert unmeasured laptop time into actionable execution insights.

## Product Principles
- Local-first (no cloud required)
- Lightweight / low CPU usage
- Minimal friction / mostly automatic
- Honest metrics over vanity charts
- Fast iteration / MVP first

## Current Architecture
Monorepo-style structure:

```text
apps/
  tracker-agent/      # background tracker process
  dashboard/          # local dashboard/API server
packages/
  db/                 # storage schema/helpers
  shared/             # future shared types/utils
  rules/              # future categorization rules
docs/
```

## What Has Been Done So Far

### Phase 1 (Completed - Issue #4)
- Repo initialized and docs added
- README + PRD created
- Workspace root package.json added
- tracker-agent starter created
- active-win integration fallback added
- basic categorization rules added
- dashboard starter server on localhost:3000
- issue #4 closed as completed

### Existing Files of Interest
- `apps/tracker-agent/index.js`
- `apps/dashboard/server.js`
- `packages/db/schema.sql`
- `packages/db/sessionStore.js`
- `docs/PRD.md`

### Phase 2 (Open - Issue #5)
Pro tracker engine:
- SQLite + session merge + summaries
- upgraded persistence/runtime behavior
- production-grade local tracking

## Current State of Code
Tracker currently uses JSON-based local logs / merged sessions as intermediate storage. SQLite schema exists but runtime is not fully wired yet.

Dashboard currently returns JSON summaries rather than polished UI.

## Immediate Next Priorities (Do These Next)
1. Wire tracker-agent to `packages/db/sessionStore.js`
2. Replace raw event spam with merged session writes
3. Integrate real SQLite runtime (`better-sqlite3` preferred)
4. Update dashboard to read SQLite summaries
5. Close issue #5 when stable

## Recommended Technical Decisions
- Use `better-sqlite3` for local DB
- Poll active window every 15-20 sec
- Merge consecutive same-app sessions
- Keep browser title/domain if available
- Add idle detection later

## Data Model Target
`sessions`
- id
- app_name
- window_title
- category
- start_time
- end_time
- duration_sec
- created_at

## Categories (Current)
- Coding
- DSA
- Learning
- Entertainment
- General

## Constraints
- Windows laptop primary target
- Free/open-source stack preferred
- Should not noticeably slow system
- Solo-builder friendly codebase

## Definition of Success (Near Term)
A daily usable local tracker that runs silently and correctly shows:
- total productive time
- top distractions
n- coding / DSA / learning totals
- today summary on localhost dashboard

## If You Are Continuing Work As Codex
Start with Issue #5. Prioritize working software over architecture polish. Make small commits referencing issue IDs. Keep docs updated.

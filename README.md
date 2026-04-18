# Auto Tracker

Privacy-first productivity tracker built for execution visibility during a 90-day career sprint.

## Vision
Measure real work, reduce distraction, and compare actual effort against weekly goals.

## MVP Features
- Background active app tracking
- Session-based time logging
- Local storage
- Rule-based categorization
- Daily summary dashboard
- Weekly target progress

## Tech Stack
- Node.js
- React + Vite
- JSON now, SQLite next
- active-win

## Run Locally
```bash
npm install active-win
npm run dev:tracker
npm run dev:dashboard
```
Open http://localhost:3000

## Repository Structure
```text
apps/
  tracker-agent/
  dashboard/
packages/
  db/
  shared/
  rules/
docs/
```

## Principles
- Local-first
- Lightweight
- Zero friction
- Honest metrics
- Fast iteration

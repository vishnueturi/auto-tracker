# Product Requirements Document (PRD)

## Product Name
Auto Tracker

## Problem Statement
Users feel busy but lack objective visibility into how laptop time aligns with weekly goals.

## Goal
Build a lightweight background tracker that measures real work, distraction, and execution progress.

## Target User
Career switchers, engineers, students, solo builders.

## MVP Scope
- Detect active application/window
- Session-based local logging
- Categorize activities
- Daily dashboard
- Weekly target progress

## Non Goals
- Surveillance tooling
- Mandatory cloud sync
- AI-heavy v1 features
- Enterprise admin tooling

## Functional Requirements
1. Run on startup
2. Poll every 20 seconds
3. Merge continuous activity into sessions
4. Store in SQLite
5. Expose summary API
6. Show dashboard insights

## Non Functional Requirements
- Low CPU usage
- <50MB memory target
- Offline first
- Privacy first
- Reliable startup

## Success Metrics
- 7-day continuous usage
- Accurate distraction detection
- Visible weekly progress improvement
- User opens dashboard daily

## Roadmap
- Weekly planner integration
- Ollama insights
- Focus streaks
- Notion sync
- Smart blockers

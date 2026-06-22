# Information architecture — how the system is organised

Research-backed navigation/IA for the app, and the decisions applied. Companion
to `HOME-DESIGN.md` (which covers the household domain).

## The problem
Navigation had grown to **9 flat top-level items** (Today, Habits, Home,
Identities, People, Progress, Ranks, Challenges, Learn) plus actions. That's well
past what users can scan, and it read as cluttered — especially on mobile.

## What the research says
- **Primary navigation: 3–5 destinations** (4 is the sweet spot). Beyond ~5,
  tabs crowd and overflow items get ignored.
- **Miller's Law (7±2)** — chunk into meaningful groups; cap top-level items
  around 7 and group the rest into **4–5 logical clusters** of ≤7.
- **Progressive disclosure** — keep the primary surface to the most-used flows;
  reveal the rest only when asked ("More").
- **Mobile** — a **bottom tab bar** for the 3–5 most-accessed destinations is the
  canonical pattern; secondary lives behind a "More" sheet.
- **Habit apps specifically** — the daily checklist ("Today") is the most-accessed
  screen; new-habit and analytics are secondary; areas/categories help grouping.

## The decision
**Primary spine (3)** — the daily-use destinations, always visible and the mobile
bottom-bar tabs:
- **Today** (the daily checklist — most-accessed), **Habits**, **Home** (shared household).

**Secondary, behind "More"** — progressive disclosure, chunked into 3 labelled
groups (Miller's law), nothing removed (the social/multiplayer features the owner
wanted stay — just grouped):
- **You** — Identities, Progress
- **Together** — People, Ranks, Challenges
- **Learn** — Learn

**Per platform**
- **Desktop**: primary inline in the top bar + a "More ▾" dropdown with the 3
  groups. Active path always highlighted (accent pill).
- **Mobile**: a fixed **bottom tab bar** (Today · Habits · Home · More); "More"
  opens a bottom sheet with the grouped links. The top bar shrinks to brand + "+ New".

## Why this is better
- Primary count drops 9 → 3 (within the 3–5 guideline); secondary is chunked into
  3 groups of ≤3 (well inside 7±2).
- The most-used screen (Today) is one tap on every device.
- Nothing was hidden — everything is one disclosure away, with its group as a label.

## Sources
- Mobile navigation best practices / tab-bar limits (UXPin, AppInstitute).
- Miller's Law in UX (UXtweak, GeeksforGeeks) — chunking & 7±2.
- Habit-app IA case studies (Habitify) — Today-first, areas for grouping.

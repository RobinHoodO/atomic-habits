# Home (shared household) — design notes & best practices

Research-backed principles for organising the shared-household system, and how
this app implements them. Goal: keep a "Hyggelig hjem" *and* a good relationship
— make the invisible work visible and fairly owned, without breeding competition.

## The three frameworks we drew on

### 1. Fair Play (Eve Rodsky) — full ownership beats 50/50
- Marital satisfaction depends far less on a perfect 50/50 split and far more on
  whether each task is **fully owned** — **Conceive → Plan → Execute (CPE)** — with
  competence and care. The deepest resentment lives in the **C and P** (the mental
  load of noticing and planning), not the execution.
- Each task has an agreed **Minimum Standard of Care (MSC)** — what "done well"
  means — decided together, up front. This kills the "but you didn't do it
  properly" fight.
- → **Implemented:** every chore has a single owner (assigned / rotating /
  conditional "den som lagde mat") who owns it end-to-end, plus a **`standard`
  field (Minimum Standard of Care)**. The app does the *Conception* (noticing it's
  due) so neither partner has to carry that mental load or nag the other — which is
  exactly section 10 of the couple's own doc ("vi minner ikke hverandre").

### 2. Tody — need-based, by area, with a health gradient
- Don't clean on a rigid calendar — clean based on **how due** each thing actually
  is, shown as a **green→red gradient**. Organise **by area/room**.
- → **Implemented:** `urgency()` turns "fraction of the cadence elapsed" into a
  green→amber→red signal; a **home-health meter** shows the share of chores
  currently on-track; the chores page can group **by area** as well as by cadence.

### 3. Sweepy + fairness research — cooperate, don't compete
- Points and a split work, but **how fair it *feels* matters more than the actual
  ratio** (Pew: 46% of partners feel they do more). Over-indexing on competition or
  extrinsic rewards breeds resentment and can undermine intrinsic motivation.
- → **Implemented:** the fairness bar is framed as neutral *data* ("Fordeling"),
  never a winner/loser; a shared **household score** + **"Hyggelig hjem" streak**
  gives a *cooperative* goal both contribute to; points default by effort/cadence.

## How the data model maps to the principles

| Principle | Field / mechanism |
|---|---|
| Full ownership (CPE) | `chores.assignee_user_id` / `rotating` / `conditional_note` |
| Minimum Standard of Care | `chores.standard` |
| Effort-weighted points | `chores.points` (default by cadence, co-designed) |
| Need-based urgency | `dueFor()` + `urgency()` from `chore_logs` |
| Fairness *feeling* | `fairness()` 30-day split, neutral framing |
| Cooperative goal | home-health meter + shared streak |
| Offloaded mental load | the "Å gjøre nå" list = the app remembers, you don't nag |
| Monthly re-evaluation (doc §10) | fairness trend is always visible; revisit & re-assign anytime |

## Deliberately NOT done (kept simple on purpose)
- No per-task time tracking — points already proxy effort.
- No external reminders/push — the in-app "due" list is the neutral nudge; nagging
  is what we're trying to remove.
- No rewards economy / spending points — that tips cooperation into transaction.

## Sources
- Eve Rodsky, *Fair Play* — CPE & Minimum Standard of Care
  (everodsky.com/fair-play-q, modernhusbands.com Fair Play system).
- Tody (need-based scheduling, cleaning-health gradient, by-area).
- Sweepy (room-based, points, fair split).
- Pew Research 2023 on perceived fairness; PMC6426245 on perceived fairness &
  relationship satisfaction.

# Atomic Habits App — Research

> Foundation research for a habit-tracking app built on James Clear's *Atomic Habits*. Two parts: (1) the behavioral framework the app should encode, (2) a scan of existing open-source habit trackers on GitHub. Book was **not** found locally as a PDF/epub; framework distilled from knowledge.

---

# Part 1 — The Atomic Habits Framework (design model)

The behavioral model the app should *encode*, not a book summary.

## 1. Core Thesis

| Principle | What it means | App-level implication |
|---|---|---|
| **The 1% rule** | Habits are compound interest of self-improvement. 1% better daily ≈ 37× over a year; 1% worse ≈ near-zero. | Make small, consistent actions feel meaningful. Surface compounding, not single days. |
| **Systems > Goals** | Goals set direction; systems produce results. "You do not rise to the level of your goals, you fall to the level of your systems." | Track processes/consistency, not just outcome targets. |
| **Identity-based habits** | Outcomes → Processes → **Identity**. Lasting change starts at identity. Each action is a "vote" for who you want to become. | Frame habits around who the user is becoming ("I am a runner"). Every completion is a vote. |

**Identity loop:** decide the type of person you want to be → prove it with small wins.

## 2. The Four Laws of Behavior Change

Every habit: **Cue → Craving → Response → Reward**.

| Stage | Build (4 Laws) | Break (inversion) |
|---|---|---|
| **1. Cue** | Make it **obvious** | Make it invisible |
| **2. Craving** | Make it **attractive** | Make it unattractive |
| **3. Response** | Make it **easy** | Make it difficult |
| **4. Reward** | Make it **satisfying** | Make it unsatisfying |

This 4×2 table is the backbone — every feature can be tagged by which law it serves.

## 3. Concrete Techniques (→ App Features)

### 3.1 Habit Stacking — *(Law 1: obvious)*
> *"After [CURRENT HABIT], I will [NEW HABIT]."*
**App →** Guided stack builder. Pick an anchor habit; new habit snaps onto it. Anchor completion fires the stacked habit's reminder. Render as visual chains.

### 3.2 Implementation Intentions — *(Law 1: obvious)*
> *"I will [BEHAVIOR] at [TIME] in [LOCATION]."*
**App →** Required time + location fields on habit creation. Time drives scheduled notification; location → optional geofence. Card shows the full sentence.

### 3.3 Environment Design — *(Law 1 / Law 3; inverted for bad habits)*
Behavior is a function of environment more than motivation.
**App →** Per-habit environment checklist ("What needs to be visible/in-reach?"). Bad habits get a "friction list" to remove cues. Optional prep reminders.

### 3.4 Temptation Bundling — *(Law 2: attractive)*
> *"After [HABIT I NEED], I will [HABIT I WANT]."*
**App →** Bundling field linking a target habit to a "want" reward (playlist, show, treat). Surface/gate the reward on completion.

### 3.5 The 2-Minute Rule — *(Law 3: easy)*
Scale any new habit to ≤2 min to start. Master showing up before optimizing.
**App →** "Gateway version" per habit. Prompt "What's the 2-minute version?". Logging the mini-version counts as a completion. "Just show up" mode.

### 3.6 Habit Tracking & "Never Miss Twice" — *(Law 4: satisfying)*
Missing once is an accident; missing twice starts a bad habit. Don't break the chain.
**App →** Daily check-off + chain calendar. On a miss: **no shaming** — surface a "Never miss twice" nudge with one-tap recovery flagged as priority. Track recovery rate.

### 3.7 Habit Scorecard — *(Awareness, precedes Law 1)*
List daily habits, mark **+ / − / =** vs the identity you want.
**App →** Onboarding/periodic audit. Bad (−) route into breaking-habit flow; good/neutral become stacking anchors.

### 3.8 The Goldilocks Rule — *(Law 4 / sustaining motivation)*
Peak motivation at the edge of ability — "just manageably difficult." Boredom, not failure, is the real threat.
**App →** Adaptive difficulty. >90% success over N weeks → prompt level-up. Success drops → suggest scaling back.

### 3.9 Habit Contracts & Accountability — *(Law 4: costly to fail)*
A written agreement with stated consequences, witnessed by a partner.
**App →** Contract builder (commitment + stake + consequence) with accountability partners notified of progress/misses. Stake can be social, not monetary.

## 4. The Habit Loop & Measuring Progress

```
   CUE  ──►  CRAVING  ──►  RESPONSE  ──►  REWARD
 (notice)   (want it)     (do it)      (enjoy/learn)
    ▲                                       │
    └───────────────────────────────────────┘
        reward reinforces the cue next time
```

| Metric | Definition | Why |
|---|---|---|
| **Streak** | Consecutive days performed. | Visible chain, motivates "don't break it." |
| **Recovery rate** | % of misses followed by next-day completion. | True resilience metric; protects vs all-or-nothing. |
| **Habit score** | Completions ÷ scheduled days (rolling window). | Forgives a single miss, rewards consistency. |
| **Identity votes** | Cumulative completions as "votes" for the identity. | Connects daily action to identity. |
| **Compounding view** | 1%-better trajectory over weeks/months. | Counters short-term invisibility of progress. |

**Design note:** streaks alone are fragile (one miss = collapse). Pair with a consistency-rate score so a slip doesn't erase months — directly encodes "never miss twice."

## 5. Pitfalls to Guard Against

| Pitfall | Warning | App counter |
|---|---|---|
| **Plateau of Latent Potential** | Results lag effort; people quit in the "Valley of Disappointment." | Show effort/consistency + compounding curve. Message "work is accumulating." |
| **Goal-orientation** | Fixating on goals → yo-yo behavior, finish-line letdown. | Center UI on systems/streaks/identity. Goals = direction only. |
| **All-or-nothing** | One miss spirals into quitting. | "Never miss twice" recovery, consistency score, 2-min fallback, zero shaming. |
| **Boredom** | The real enemy once novelty fades. | Goldilocks adaptive difficulty, level-ups. |
| **Optimizing before establishing** | Perfecting a habit before it exists. | 2-minute rule enforces frequency before intensity. |

**One-line summary:** build around **identity + systems**, structure features under the **Four Laws** (with inversions), measure with a **forgiving consistency score**, and counter the **plateau / goal-fixation / all-or-nothing** failure modes.

---

# Part 2 — Open-Source Habit Trackers on GitHub (June 2026)

Ranked by suitability as a foundation for a clean, modern web app (Next.js/React weighted highest).

| # | Repo | ⭐ | Stack | License | Maintained | Atomic Habits framework? |
|---|------|-----|-------|---------|------------|--------------------------|
| 1 | [iotawise](https://github.com/redpangilinan/iotawise) | 264 | Next.js App Router / TS / Postgres+Prisma / NextAuth / shadcn | MIT | Stalled ~9mo | ❌ Generic |
| 2 | [streak-calendar](https://github.com/ilyaizen/streak-calendar) | 117 | Next.js / TS / Convex / shadcn | MIT | Active | ❌ Generic |
| 3 | [habitly](https://github.com/0xAliRaza/habitly) | 25 | Vue 3 / Django REST + MySQL | MIT | Active | ✅ **Explicit** (stacking + intentions) |
| 4 | [beaverhabits](https://github.com/daya0576/beaverhabits) | 1.8k | NiceGUI / Python / SQLite | BSD-3 | Active | ❌ Minimalist by design |
| 5 | [habitsync](https://github.com/jofoerster/habitsync) | 322 | TS + Spring Boot / Postgres | BSD-3 | Active | ❌ Generic + social |
| 6 | [Habo](https://github.com/xpavle00/Habo) | 1.3k | Flutter / Supabase | GPL-3.0 | Active | ❌ Generic, privacy-led |
| 7 | [Atomic.io](https://github.com/ahorovit/Atomic.io) | 0 | Android / Kotlin / Room | Unspecified | Inactive | ⚠️ Partial (identity layer) |
| 8 | [Loop / uhabits](https://github.com/iSoron/uhabits) | ~8k | Android / Java-Kotlin / SQLite | GPL-3.0 | Mature | ⚠️ Best **scoring** algorithm |

**Key finding:** almost no project implements the full cue→craving→response→reward loop or 1%-better scoring. Closest: **habitly** (stacking + implementation intentions), **Atomic.io** (identity layer). **Loop** has the best habit-scoring math (but Android/Java). Most "atomic habits" apps borrow only the name and streaks — **that gap is the opportunity for a new app.**

## Recommendation

1. **iotawise** — cleanest fork chassis: already Next.js + TS + Prisma/Postgres + NextAuth + shadcn, MIT. Inherit modern plumbing, layer Atomic Habits logic on top. Caveat: quiet ~9mo, treat as skeleton not dependency.
2. **streak-calendar** — best to study for UX: GitHub-style activity grid, multi-habit calendar. (Convex backend you'd likely swap for Postgres.)
3. **habitly** — mine for *concepts*: only web app that implements Clear's actionable mechanics. Read the domain model even though Vue+Django diverges. For scoring math, skim **Loop/uhabits**.

**Bottom line:** fork **iotawise** for the chassis, borrow **streak-calendar**'s viz, implement the actual Atomic Habits domain model yourself (no repo does it well in a modern web stack — that's the niche).

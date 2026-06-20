# Atomic Habits

A self-hosted habit tracker that encodes the **entire** framework from James Clear's
*Atomic Habits* — not just streaks. Multi-user with email/password login, a social layer
(follow people, pair up on habits), a book-organised interactive **Learn** hub, a guided
**onboarding wizard**, and an **ElevenLabs voice coach** that interviews you and fills your
first habit in live as you talk. Local-first: your box, your SQLite file, no SaaS cloud —
other people connect to *your* instance.

See [`RESEARCH.md`](./RESEARCH.md) for the full framework write-up and the GitHub repo
scan that informed the build. The book itself is in `resources/` (gitignored).

## Run it

```bash
npm install
npm run dev      # http://127.0.0.1:3005  → register, then onboarding
npm test         # scoring-logic checks (lib/score.test.ts)
npm run build    # production build
```

### Environment (`.env.local`, gitignored)
- `AUTH_SECRET` — Auth.js session secret (`openssl rand -base64 32`).
- `ELEVENLABS_API_KEY` — for the voice coach (copied from the workspace `.env`).
- `COACH_AGENT_ID` — the ElevenLabs Conversational AI agent id (created via the API).

### Voice coach
On the first-habit / onboarding screen, **🎙 Coach me** starts an ElevenLabs
Conversational AI agent. It interviews you and calls client tools (`set_identity`,
`set_field`) that fill the wizard live while you watch. Token is minted server-side
(`/api/coach/token`) so the API key never reaches the browser. Needs a Chromium-based
browser + mic permission.

Stack: Next.js 16 (App Router) · React 19 · TypeScript · Tailwind 4 · better-sqlite3.
Data access is **Server Components + Server Actions straight to SQLite** — no API layer,
no client data-fetching (single-user, no auth, so none is needed). Forms work via
progressive enhancement; almost no client JS.

## Framework → feature mapping

| Atomic Habits concept | Where it lives |
|---|---|
| Identity-based habits, "votes" | `/identities` — name + "I am a…" statement; every completion is a vote |
| Four Laws (Cue→Craving→Response→Reward) | Per-habit loop fields; **inverted** automatically for `bad` habits |
| Habit scorecard (+/−/=) | Habit `type` (good / bad / neutral) shown on `/habits` |
| Implementation intentions | Time + location fields → "I will X at TIME in LOCATION" |
| 2-minute rule | `gateway_text`; "Just showed up (2-min)" check-off counts |
| Habit stacking | Stack builder on habit detail — "After ANCHOR, I will THIS" |
| Temptation bundling | Per-habit "want" list |
| Environment design | Per-habit list, `obvious` (good) vs `friction` (bad) |
| Habit contract / accountability | Commitment + stake + consequence + partner (stored; see note) |
| Don't break the chain | GitHub-style chain calendar |
| **Never miss twice** | Nudge when the last two scheduled days were both missed |
| Forgiving progress | Consistency % + recovery rate, not just a fragile streak |

## Scoring (`lib/score.ts`)

Pure, framework-free, fully tested (`npm test`):

- **streak** — consecutive scheduled days completed (today-not-yet-done doesn't break it)
- **consistency** — completions ÷ scheduled days over 30d (one miss won't zero it)
- **recovery rate** — fraction of misses recovered the next scheduled day
- **never-miss-twice** — last two evaluable scheduled days both missed
- **due today** — scheduled today and not yet done

## Deliberate cuts (add when needed)

- **OS push notifications / scheduled reminders** — needs a service worker + permissions.
  In-app "due today" + nudges cover the local case. Add when it leaves the Mac.
- **Accountability-partner delivery** — the contract (incl. partner) is stored, but nobody
  is notified (single-user, local). Wire up when this goes multi-user.

Both leave room in the data model; neither is plumbed.

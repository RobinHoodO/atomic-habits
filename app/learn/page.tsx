import Link from "next/link";
import {
  Compounding,
  HabitLoop,
  FourLaws,
  Plateau,
  IdentityLayers,
} from "@/components/LearnVisuals";

export const dynamic = "force-dynamic";

const TOC = [
  ["fundamentals", "The Fundamentals"],
  ["four-laws", "The Four Laws"],
  ["obvious", "1st Law — Make It Obvious"],
  ["attractive", "2nd Law — Make It Attractive"],
  ["easy", "3rd Law — Make It Easy"],
  ["satisfying", "4th Law — Make It Satisfying"],
  ["advanced", "Advanced Tactics"],
];

function Section({ id, kicker, title, children }: { id: string; kicker: string; title: string; children: React.ReactNode }) {
  return (
    <section id={id} className="scroll-mt-20 flex flex-col gap-4 border-t border-border pt-8">
      <div>
        <div className="text-xs font-semibold uppercase tracking-wide text-accent">{kicker}</div>
        <h2 className="text-xl font-bold">{title}</h2>
      </div>
      {children}
    </section>
  );
}

function Try({ href, children }: { href: string; children: React.ReactNode }) {
  return (
    <Link href={href} className="text-sm font-medium text-accent hover:underline">
      → {children}
    </Link>
  );
}

export default function LearnPage() {
  return (
    <div className="flex flex-col gap-8">
      <header className="flex flex-col gap-2">
        <h1 className="text-3xl font-bold">How habits actually work</h1>
        <p className="text-muted">
          The whole <em>Atomic Habits</em> framework, organised like the book — with the ideas you can
          poke at. Then build your own system in the app.
        </p>
        <nav className="mt-2 flex flex-wrap gap-2 text-sm">
          {TOC.map(([id, label]) => (
            <a key={id} href={`#${id}`} className="rounded-full border border-border bg-surface-2 px-3 py-1 text-muted hover:text-foreground">
              {label}
            </a>
          ))}
        </nav>
      </header>

      <Section id="fundamentals" kicker="Part 1" title="The Fundamentals">
        <p className="text-sm">
          You do not rise to the level of your goals; you fall to the level of your <strong>systems</strong>.
          Habits are the compound interest of self-improvement — tiny margins that look like nothing day to
          day and like everything over a year.
        </p>
        <div className="card"><Compounding /></div>

        <h3 className="mt-2 font-semibold">Change happens from the inside out</h3>
        <p className="text-sm">Three layers. Most people aim at outcomes. Lasting change starts at identity — and every habit you complete is a vote for it.</p>
        <div className="card"><IdentityLayers /></div>
        <Try href="/identities">Define an identity you're voting for</Try>

        <h3 className="mt-2 font-semibold">The habit loop</h3>
        <p className="text-sm">Every habit runs the same four-stage loop. The Four Laws are just how you tune each stage.</p>
        <div className="card"><HabitLoop /></div>

        <h3 className="mt-2 font-semibold">The plateau of latent potential</h3>
        <div className="card"><Plateau /></div>
      </Section>

      <Section id="four-laws" kicker="Part 2" title="The Four Laws of Behavior Change">
        <p className="text-sm">To build a good habit, make each stage work for you. To break a bad one, invert each law.</p>
        <div className="card"><FourLaws /></div>
        <p className="text-sm text-muted">In the app, a habit's <strong>type</strong> (+ good / − bad) flips its loop to the build or break side automatically.</p>
      </Section>

      <Section id="obvious" kicker="1st Law" title="Make It Obvious">
        <ul className="flex flex-col gap-2 text-sm">
          <li><strong>Habit scorecard.</strong> List what you already do and mark each +/−/=. Awareness comes before change.</li>
          <li><strong>Implementation intentions.</strong> “I will [behavior] at [time] in [location].” Specificity beats motivation.</li>
          <li><strong>Habit stacking.</strong> “After [current habit], I will [new habit].” The done habit becomes the cue for the next.</li>
          <li><strong>Environment design.</strong> Make good cues visible and in reach; make bad cues invisible.</li>
        </ul>
        <div className="flex gap-4">
          <Try href="/habits/new">Add a habit with a time + place</Try>
          <Try href="/habits">See your scorecard</Try>
        </div>
      </Section>

      <Section id="attractive" kicker="2nd Law" title="Make It Attractive">
        <p className="text-sm"><strong>Temptation bundling:</strong> pair something you need to do with something you want. “Only listen to my favourite podcast while exercising.” The craving for the want pulls the habit along.</p>
        <Try href="/habits">Bundle a want onto a habit</Try>
      </Section>

      <Section id="easy" kicker="3rd Law" title="Make It Easy">
        <ul className="flex flex-col gap-2 text-sm">
          <li><strong>The 2-minute rule.</strong> Scale any new habit down to two minutes. “Read before bed” → “read one page.” Master showing up before optimising.</li>
          <li><strong>Reduce friction.</strong> Make good habits take fewer steps; add steps to bad ones.</li>
        </ul>
        <p className="text-sm text-muted">Each habit can store its 2-minute version — and logging that mini version still counts as showing up.</p>
        <Try href="/habits/new">Set a habit's 2-minute version</Try>
      </Section>

      <Section id="satisfying" kicker="4th Law" title="Make It Satisfying">
        <ul className="flex flex-col gap-2 text-sm">
          <li><strong>Track it.</strong> A visible chain is its own reward. Don't break the chain.</li>
          <li><strong>Never miss twice.</strong> Missing once is an accident; missing twice starts a new habit. Getting back on is the win — the app nudges you, never shames you.</li>
          <li><strong>Habit contract.</strong> Add an accountability partner and a stake to make slipping costly.</li>
        </ul>
        <div className="flex gap-4">
          <Try href="/">Check in on today</Try>
          <Try href="/people">Add an accountability partner</Try>
        </div>
      </Section>

      <Section id="advanced" kicker="Advanced" title="Staying in the game">
        <p className="text-sm"><strong>The Goldilocks rule:</strong> motivation peaks at the edge of your ability — tasks just manageably hard. The real threat isn't failure, it's boredom. When a habit gets easy and automatic, level it up.</p>
        <p className="text-sm text-muted">The app's forgiving <em>consistency</em> score (not just a fragile streak) is built for this — a single slip doesn't erase months.</p>
      </Section>

      <div className="border-t border-border pt-8 text-center">
        <p className="mb-3 text-muted">Ready to build your system?</p>
        <Link href="/habits/new" className="btn btn-primary">Create a habit</Link>
      </div>
    </div>
  );
}

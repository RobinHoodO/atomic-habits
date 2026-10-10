import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { homeForUser, homeMembers, listRewards, listRedemptions, walletByMember } from "@/lib/home";
import { addRewardAction, deleteRewardAction, redeemRewardAction, markGivenAction } from "@/app/home-actions";

export const dynamic = "force-dynamic";

// Premier: the couple sets prizes ("Massasje fra den andre", 10 p) and buys them with Home points.
export default async function PremierPage({ searchParams }: { searchParams: Promise<{ r?: string }> }) {
  const user = await requireUser();
  const home = await homeForUser(user.id);
  if (!home) redirect("/home");

  const { r } = await searchParams;
  const members = await homeMembers(home.id);
  const nameOf = new Map(members.map((m) => [Number(m.user_id), m.name]));
  const wallet = await walletByMember(home.id);
  const rewards = await listRewards(home.id);
  const redemptions = await listRedemptions(home.id);
  const mine = wallet[user.id] ?? 0;
  const open = redemptions.filter((d) => !d.given_at);
  const given = redemptions.filter((d) => d.given_at);

  return (
    <div className="flex flex-col gap-5">
      <header className="flex items-start justify-between gap-3">
        <div>
          <h1 className="text-xl font-bold">Premier</h1>
          <p className="text-sm text-muted">Samle poeng. Løs dem inn hos den andre.</p>
        </div>
      </header>

      <div className="card flex flex-wrap gap-x-6 gap-y-1 text-sm">
        {members.map((m) => (
          <span key={m.user_id}>
            {Number(m.user_id) === user.id ? "Du" : m.name}: <strong>{wallet[Number(m.user_id)] ?? 0} p</strong>
          </span>
        ))}
      </div>

      {r === "poor" && <p className="text-sm text-bad">Ikke nok poeng ennå.</p>}

      {open.length > 0 && (
        <section className="flex flex-col gap-2">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Venter</h2>
          {open.map((d) => (
            <div key={d.id} className="card flex items-center justify-between gap-3 py-3 text-sm">
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.title}</span>
                <span className="text-xs text-muted">
                  {Number(d.user_id) === user.id ? "Du løste inn" : `${nameOf.get(Number(d.user_id))} løste inn`} · {d.cost} p
                </span>
              </span>
              {Number(d.user_id) !== user.id && (
                <form action={markGivenAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="btn btn-primary">Gitt ✓</button>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-2">
        <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Premier</h2>
        {rewards.length === 0 && <p className="text-sm text-muted">Ingen premier ennå. Lag den første under.</p>}
        {rewards.map((w) => (
          <div key={w.id} className="card flex items-center justify-between gap-3 py-3 text-sm">
            <span className="min-w-0 truncate font-medium">{w.title}</span>
            <div className="flex shrink-0 items-center gap-2">
              <form action={redeemRewardAction}>
                <input type="hidden" name="id" value={w.id} />
                <button className="btn btn-primary whitespace-nowrap" disabled={mine < w.cost}>
                  Løs inn · {w.cost} p
                </button>
              </form>
              <form action={deleteRewardAction}>
                <input type="hidden" name="id" value={w.id} />
                <button className="text-muted hover:text-bad" aria-label={`Slett ${w.title}`}>✕</button>
              </form>
            </div>
          </div>
        ))}
        <form action={addRewardAction} className="card flex flex-wrap items-center gap-2 text-sm">
          <input className="input flex-1" name="title" placeholder="Ny premie, f.eks. «Massasje»" required />
          <input className="input w-20" type="number" name="cost" min={1} defaultValue={10} aria-label="Poeng" />
          <span className="text-muted">p</span>
          <button className="btn">Legg til</button>
        </form>
      </section>

      {given.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted">
            ▸ Gitt ({given.length})
          </summary>
          <ul className="mt-2 flex flex-col gap-1 text-sm text-muted">
            {given.map((d) => (
              <li key={d.id}>{d.title} · {nameOf.get(Number(d.user_id))} · {d.cost} p</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

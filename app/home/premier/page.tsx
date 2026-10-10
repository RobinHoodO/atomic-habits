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
    <div className="flex flex-col gap-3">
      <div className="card flex flex-wrap gap-x-5 gap-y-0.5 rounded-xl px-3 py-1.5 text-sm shadow-none">
        {members.map((m) => (
          <span key={m.user_id}>
            {Number(m.user_id) === user.id ? "Du" : m.name}: <strong>{wallet[Number(m.user_id)] ?? 0} p</strong>
          </span>
        ))}
      </div>

      {r === "poor" && <p className="text-sm text-bad">Ikke nok poeng ennå.</p>}

      {open.length > 0 && (
        <section className="flex flex-col gap-1.5">
          <h2 className="text-xs font-semibold uppercase tracking-wide text-muted">Venter</h2>
          {open.map((d) => (
            <div key={d.id} className="card flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm shadow-none">
              <span className="min-w-0">
                <span className="block truncate font-medium">{d.title}</span>
                <span className="text-xs text-muted">
                  {Number(d.user_id) === user.id ? "Du løste inn" : `${nameOf.get(Number(d.user_id))} løste inn`} · {d.cost} p
                </span>
              </span>
              {Number(d.user_id) !== user.id && (
                <form action={markGivenAction}>
                  <input type="hidden" name="id" value={d.id} />
                  <button className="btn btn-primary h-10 px-3">Gitt ✓</button>
                </form>
              )}
            </div>
          ))}
        </section>
      )}

      <section className="flex flex-col gap-1.5">
        {rewards.length === 0 && <p className="text-sm text-muted">Ingen premier ennå.</p>}
        {rewards.map((w) => (
          <div key={w.id} className="card flex items-center justify-between gap-2 rounded-xl px-3 py-1.5 text-sm shadow-none">
            <span className="min-w-0 truncate font-medium">{w.title}</span>
            <div className="flex shrink-0 items-center gap-1">
              <form action={redeemRewardAction}>
                <input type="hidden" name="id" value={w.id} />
                <button className="btn btn-primary h-10 whitespace-nowrap px-3" disabled={mine < w.cost}>
                  Løs inn · {w.cost} p
                </button>
              </form>
              <form action={deleteRewardAction}>
                <input type="hidden" name="id" value={w.id} />
                <button className="flex h-10 w-9 items-center justify-center text-muted hover:text-bad" aria-label={`Slett ${w.title}`}>✕</button>
              </form>
            </div>
          </div>
        ))}
        <form action={addRewardAction} className="card flex items-center gap-1.5 rounded-xl px-2 py-2 text-sm shadow-none">
          <input className="input h-10 min-w-0 flex-1 py-1" name="title" placeholder="Ny premie, f.eks. «Massasje»" required />
          <input className="input h-10 w-16 px-2 py-1" type="number" name="cost" min={1} defaultValue={10} aria-label="Poeng" />
          <button className="btn btn-primary h-10 w-10 px-0 text-lg" aria-label="Legg til" title="Legg til">+</button>
        </form>
      </section>

      {given.length > 0 && (
        <details>
          <summary className="cursor-pointer list-none text-xs font-semibold uppercase tracking-wide text-muted">
            ▸ Gitt ({given.length})
          </summary>
          <ul className="mt-1 flex flex-col gap-0.5 text-sm text-muted">
            {given.map((d) => (
              <li key={d.id}>{d.title} · {nameOf.get(Number(d.user_id))} · {d.cost} p</li>
            ))}
          </ul>
        </details>
      )}
    </div>
  );
}

import { listIdentities, identityVotes, listHabits } from "@/lib/habits";
import { createIdentityAction } from "@/app/actions";
import { requireUser } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function IdentitiesPage() {
  const user = await requireUser();
  const identities = listIdentities(user.id);
  const habits = listHabits(user.id, true);
  const habitCount = new Map<number, number>();
  for (const h of habits) {
    if (h.identity_id)
      habitCount.set(h.identity_id, (habitCount.get(h.identity_id) ?? 0) + 1);
  }

  return (
    <div className="flex flex-col gap-5">
      <header>
        <h1 className="text-xl font-bold">Identities</h1>
        <p className="text-sm text-muted">
          Every completion is a vote for the person you want to become.
        </p>
      </header>

      {identities.length === 0 ? (
        <div className="card text-muted">No identities yet — add one below.</div>
      ) : (
        <div className="flex flex-col gap-3">
          {identities.map((i) => (
            <div key={i.id} className="card flex items-center justify-between">
              <div>
                <div className="font-semibold">{i.name}</div>
                <div className="text-sm text-muted italic">“{i.statement}”</div>
                <div className="mt-1 text-xs text-muted">
                  {habitCount.get(i.id) ?? 0} habit(s)
                </div>
              </div>
              <div className="rounded-lg border border-border bg-surface-2 px-4 py-2 text-center">
                <div className="text-2xl font-bold text-good">{identityVotes(i.id, user.id)}</div>
                <div className="text-[0.7rem] uppercase tracking-wide text-muted">votes</div>
              </div>
            </div>
          ))}
        </div>
      )}

      <form action={createIdentityAction} className="card flex flex-col gap-3">
        <div className="font-semibold">New identity</div>
        <div className="grid grid-cols-2 gap-3">
          <div>
            <label className="label req">Name</label>
            <input className="input" name="name" data-label="a name" required placeholder="Runner" />
          </div>
          <div>
            <label className="label req">Statement</label>
            <input className="input" name="statement" data-label="a statement" required placeholder="I am a runner" />
          </div>
        </div>
        <SubmitButton>Add identity</SubmitButton>
      </form>
    </div>
  );
}

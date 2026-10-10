import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { homeForUser, homeMembers, recentHomeEvents, getSeenAt, markHomeSeen } from "@/lib/home";
import { unreadThreshold, isFresh, eventText, whenLabel } from "@/lib/home-events";

export const dynamic = "force-dynamic";

// Varsler: the last 30 things in the home. Opening the page marks them seen.
export default async function VarslerPage() {
  const user = await requireUser();
  const home = await homeForUser(user.id);
  if (!home) redirect("/home");

  const members = await homeMembers(home.id);
  const nameOf = new Map(members.map((m) => [Number(m.user_id), m.name]));
  const threshold = unreadThreshold(await getSeenAt(home.id, user.id));
  const events = await recentHomeEvents(home.id, 30);

  // Render-time write on purpose: this page is dynamic and only reached by an
  // explicit visit, so "I looked" == "mark seen". A server action would need a
  // client-side trigger for no gain. The unread highlight above uses the old threshold.
  await markHomeSeen(home.id, user.id);

  return (
    <div className="flex flex-col gap-3">
      <header>
        <h1 className="text-xl font-bold">Varsler</h1>
        <p className="text-sm text-muted">Hva som har skjedd hjemme.</p>
      </header>
      {events.length === 0 && <p className="text-sm text-muted">Ingenting ennå.</p>}
      <ul className="flex flex-col gap-2">
        {events.map((e) => {
          const unread = isFresh(e.actor_id, e.created_at, user.id, threshold);
          const who = Number(e.actor_id) === user.id ? "Du" : nameOf.get(Number(e.actor_id)) ?? "Noen";
          return (
            <li key={e.id} className={`card flex items-center justify-between gap-3 py-2 text-sm ${unread ? "ring-2 ring-accent/40" : ""}`}>
              <span className="min-w-0">
                {unread && <span aria-hidden className="mr-1.5 text-accent">●</span>}
                {eventText(e, who, user.id)}
              </span>
              <span className="shrink-0 text-xs text-muted">{whenLabel(e.created_at)}</span>
            </li>
          );
        })}
      </ul>
    </div>
  );
}

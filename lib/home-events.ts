// Pure rules for Varsler and the "Ny" marker. Timestamps are the DB's
// "YYYY-MM-DD HH:MM:SS" (UTC), so plain string comparison orders them.

export type EventKind = "chore_added" | "chore_changed" | "task_added" | "chore_given";

export interface HomeEvent {
  id: number;
  home_id: number;
  actor_id: number;
  kind: EventKind;
  title: string;
  target_user_id: number | null;
  ref_kind: "routine" | "task" | null;
  ref_id: number | null;
  created_at: string;
}

export const UNREAD_DAYS = 14;

export function dbStamp(ms: number): string {
  return new Date(ms).toISOString().slice(0, 19).replace("T", " ");
}

// Anything created after this is unread: the user's seen_at, or 14 days back if never seen.
export function unreadThreshold(seenAt: string | null, nowMs = Date.now()): string {
  return seenAt ?? dbStamp(nowMs - UNREAD_DAYS * 86_400_000);
}

// Someone else made it, after the threshold.
export function isFresh(
  creator: number | null,
  createdAt: string,
  userId: number,
  threshold: string,
): boolean {
  return creator != null && Number(creator) !== userId && createdAt > threshold;
}

export function unreadEvents(events: HomeEvent[], userId: number, threshold: string): HomeEvent[] {
  return events.filter((e) => isFresh(e.actor_id, e.created_at, userId, threshold));
}

// "i dag 14:05", "i går 09:30", else "3. okt". Stored times are UTC.
export function whenLabel(createdAt: string, nowMs = Date.now()): string {
  const d = new Date(createdAt.replace(" ", "T") + "Z");
  const day = (x: Date) => x.toLocaleDateString("sv-SE", { timeZone: "Europe/Oslo" });
  const time = d.toLocaleTimeString("nb-NO", { timeZone: "Europe/Oslo", hour: "2-digit", minute: "2-digit" });
  if (day(d) === day(new Date(nowMs))) return `i dag ${time}`;
  if (day(d) === day(new Date(nowMs - 86_400_000))) return `i går ${time}`;
  return d.toLocaleDateString("nb-NO", { timeZone: "Europe/Oslo", day: "numeric", month: "short" });
}

// "Ania la til rutine «X»" and friends. `who` is the actor's name; `me` the viewer.
export function eventText(e: HomeEvent, who: string, me: number): string {
  switch (e.kind) {
    case "chore_added":
      return `${who} la til rutine «${e.title}»`;
    case "chore_changed":
      return `${who} endret rutine «${e.title}»`;
    case "task_added":
      return Number(e.target_user_id) === me
        ? `${who} la til oppgave til deg: «${e.title}»`
        : `${who} la til oppgave «${e.title}»`;
    case "chore_given":
      return Number(e.target_user_id) === me ? `${who} ga deg «${e.title}»` : `${who} ga bort «${e.title}»`;
  }
}

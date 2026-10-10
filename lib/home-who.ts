// "Hvem" filter for Rutiner and Oppgaver: ?who=all|me|felles|turns|<member id>.
export type Who = "all" | "me" | "felles" | "turns" | number;

// Anything unknown (or an id outside this home) falls back to "all".
export function parseWho(raw: string | undefined, memberIds: number[], me: number, allowTurns: boolean): Who {
  if (raw === "me" || raw === "felles") return raw;
  if (raw === "turns" && allowTurns) return raw;
  if (raw && /^\d+$/.test(raw)) {
    const id = Number(raw);
    if (id === me) return "me";
    if (memberIds.includes(id)) return id;
  }
  return "all";
}

export function matchesWho(who: Who, owner: number | null, rotating: boolean, me: number): boolean {
  switch (who) {
    case "all":
      return true;
    case "me":
      return !rotating && owner === me;
    case "felles":
      return !rotating && owner == null;
    case "turns":
      return rotating;
    default:
      return !rotating && owner === who;
  }
}

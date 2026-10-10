"use client";

import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { toggleCompletionAction } from "@/app/actions";
import { celebrate, originOf, primeAudio, type Origin } from "@/components/Celebrate";
import { listCleared } from "@/lib/fun";
import { gjortChoreAction, undoChoreAction, completeTaskAction } from "@/app/home-actions";

type Kind = "habit" | "routine" | "task";
type Target = { kind: Kind; id: number; title: string; date: string };
type Undo = Target & { key: string; logId: number };

type Ctx = {
  hidden: Set<string>;
  undos: Undo[];
  error: string | null;
  gjort: (t: Target, origin?: Origin) => void;
  undo: (u: Undo) => void;
};

const GjortContext = createContext<Ctx | null>(null);

const keyOf = (kind: Kind, id: number) => `${kind}${id}`;

function habitForm(t: Target): FormData {
  const fd = new FormData();
  fd.set("habit_id", String(t.id));
  fd.set("date", t.date);
  return fd;
}

function idForm(id: number, extra: Record<string, string> = {}): FormData {
  const fd = new FormData();
  fd.set("id", String(id));
  for (const [k, v] of Object.entries(extra)) fd.set(k, v);
  return fd;
}

// Optimistic Gjort: the row disappears on tap, the server action runs in the
// background, and an inline "Angre" bar replaces it.
// `todayKeys` (optional) = keys of the items on the I dag list; when the last one
// is done, a bigger party fires.
export default function GjortProvider({ children, todayKeys }: { children: ReactNode; todayKeys?: string[] }) {
  const [hidden, setHidden] = useState<Set<string>>(new Set());
  const [undos, setUndos] = useState<Undo[]>([]);
  const [error, setError] = useState<string | null>(null);
  const [, startTransition] = useTransition();

  const setKeyHidden = useCallback((key: string, on: boolean) => {
    setHidden((prev) => {
      const next = new Set(prev);
      if (on) next.add(key);
      else next.delete(key);
      return next;
    });
  }, []);

  const gjort = useCallback(
    (t: Target, origin?: Origin) => {
      const key = keyOf(t.kind, t.id);
      celebrate(origin, listCleared(todayKeys ?? [], hidden, key));
      setError(null);
      setKeyHidden(key, true);
      startTransition(async () => {
        try {
          let logId = 0;
          if (t.kind === "habit") await toggleCompletionAction(habitForm(t));
          else if (t.kind === "routine") logId = await gjortChoreAction(idForm(t.id));
          else await completeTaskAction(idForm(t.id));
          // routine already closed by someone else: nothing to undo
          if (t.kind === "routine" && logId === 0) return;
          setUndos((prev) => [...prev.filter((u) => u.key !== key), { ...t, key, logId }]);
        } catch {
          setKeyHidden(key, false);
          setError(`Kunne ikke lagre «${t.title}». Prøv igjen.`);
        }
      });
    },
    [setKeyHidden, todayKeys, hidden],
  );

  const undo = useCallback(
    (u: Undo) => {
      setError(null);
      setUndos((prev) => prev.filter((x) => x.key !== u.key));
      setKeyHidden(u.key, false);
      startTransition(async () => {
        try {
          if (u.kind === "habit") await toggleCompletionAction(habitForm(u));
          else if (u.kind === "routine") {
            const fd = new FormData();
            fd.set("log", String(u.logId));
            await undoChoreAction(fd);
          } else await completeTaskAction(idForm(u.id, { undo: "1" }));
        } catch {
          setKeyHidden(u.key, true);
          setUndos((prev) => [...prev, u]);
          setError(`Kunne ikke angre «${u.title}». Prøv igjen.`);
        }
      });
    },
    [setKeyHidden],
  );

  return <GjortContext.Provider value={{ hidden, undos, error, gjort, undo }}>{children}</GjortContext.Provider>;
}

function useGjort(): Ctx {
  const ctx = useContext(GjortContext);
  if (!ctx) throw new Error("GjortProvider missing");
  return ctx;
}

export function GjortRow({
  kind,
  id,
  className,
  children,
}: {
  kind: Kind;
  id: number;
  className?: string;
  children: ReactNode;
}) {
  const { hidden } = useGjort();
  if (hidden.has(keyOf(kind, id))) return null;
  return <li className={className}>{children}</li>;
}

export function GjortButton(t: Target) {
  const { gjort } = useGjort();
  return (
    <button type="button" className="btn btn-primary h-10 whitespace-nowrap px-3.5" onClick={(e) => {
        primeAudio();
        gjort(t, originOf(e.currentTarget));
      }}>
      Gjort
    </button>
  );
}

export function UndoBars() {
  const { undos, error, undo } = useGjort();
  return (
    <>
      {error && (
        <p role="alert" className="card px-3 py-1.5 text-sm text-bad shadow-none">
          {error}
        </p>
      )}
      {undos.map((u) => (
        <div key={u.key} className="card flex items-center justify-between gap-2 px-3 py-1.5 text-sm shadow-none">
          <span className="min-w-0 truncate">✓ «{u.title}» gjort</span>
          <button type="button" className="btn h-10 px-3" onClick={() => undo(u)}>
            Angre
          </button>
        </div>
      ))}
    </>
  );
}

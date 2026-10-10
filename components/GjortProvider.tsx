"use client";

import { createContext, useCallback, useContext, useState, useTransition, type ReactNode } from "react";
import { toggleCompletionAction } from "@/app/actions";
import { gjortChoreAction, undoChoreAction, completeTaskAction } from "@/app/home-actions";

type Kind = "habit" | "routine" | "task";
type Target = { kind: Kind; id: number; title: string; date: string };
type Undo = Target & { key: string; logId: number };

type Ctx = {
  hidden: Set<string>;
  undos: Undo[];
  error: string | null;
  gjort: (t: Target) => void;
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
export default function GjortProvider({ children }: { children: ReactNode }) {
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
    (t: Target) => {
      const key = keyOf(t.kind, t.id);
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
    [setKeyHidden],
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
    <button type="button" className="btn btn-primary whitespace-nowrap" onClick={() => gjort(t)}>
      Gjort
    </button>
  );
}

export function UndoBars() {
  const { undos, error, undo } = useGjort();
  return (
    <>
      {error && (
        <p role="alert" className="card py-2 text-sm text-bad">
          {error}
        </p>
      )}
      {undos.map((u) => (
        <div key={u.key} className="card flex items-center justify-between gap-3 py-2 text-sm">
          <span className="min-w-0 truncate">✓ «{u.title}» gjort</span>
          <button type="button" className="btn" onClick={() => undo(u)}>
            Angre
          </button>
        </div>
      ))}
    </>
  );
}

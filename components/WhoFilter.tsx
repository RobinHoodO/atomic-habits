import Link from "next/link";
import type { Who } from "@/lib/home-who";

// Filter pills as plain links (?who=…), so no client JS.
export default function WhoFilter({
  path,
  members,
  me,
  current,
  withTurns,
}: {
  path: string;
  members: { user_id: number; name: string }[];
  me: number;
  current: Who;
  withTurns?: boolean;
}) {
  const opts: { key: string; label: string }[] = [
    { key: "all", label: "Alle" },
    { key: "me", label: "Meg" },
    ...members.filter((m) => Number(m.user_id) !== me).map((m) => ({ key: String(m.user_id), label: m.name })),
    { key: "felles", label: "Felles" },
    ...(withTurns ? [{ key: "turns", label: "Bytter på" }] : []),
  ];
  return (
    <nav className="-mx-4 flex gap-1 overflow-x-auto px-4 pb-0.5 [scrollbar-width:none]" aria-label="Filtrer på hvem">
      {opts.map((o) => (
        <Link
          key={o.key}
          href={o.key === "all" ? path : `${path}?who=${o.key}`}
          aria-current={String(current) === o.key ? "true" : undefined}
          className={`btn shrink-0 whitespace-nowrap px-2.5 py-1.5 text-xs shadow-none ${String(current) === o.key ? "border-accent bg-accent text-white" : ""}`}
        >
          {o.label}
        </Link>
      ))}
    </nav>
  );
}

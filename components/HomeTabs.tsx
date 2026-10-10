"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home/chores", label: "Rutiner" },
  { href: "/home/tasks", label: "Oppgaver" },
  { href: "/home/premier", label: "Premier" },
];

// Tabs across the Hjem section. Hidden on /home itself (the make-a-home form).
export default function HomeTabs() {
  const pathname = usePathname();
  if (pathname === "/home") return null;
  return (
    <nav className="mb-4 flex gap-1 rounded-xl border border-border bg-surface p-1 text-sm" aria-label="Hjem">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 rounded-lg px-3 py-1.5 text-center transition-colors ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {t.label}
          </Link>
        );
      })}
    </nav>
  );
}

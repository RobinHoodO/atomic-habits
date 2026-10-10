"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/home/chores", label: "Rutiner" },
  { href: "/home/tasks", label: "Oppgaver" },
  { href: "/home/premier", label: "Premier" },
  { href: "/home/varsler", label: "Varsler" },
];

// Tabs across the Hjem section. Hidden on /home itself (the make-a-home form).
export default function HomeTabs({ unread = 0 }: { unread?: number }) {
  const pathname = usePathname();
  if (pathname === "/home") return null;
  return (
    <nav className="mb-2 flex gap-0.5 rounded-lg border border-border bg-surface p-0.5 text-[13px]" aria-label="Hjem">
      {TABS.map((t) => {
        const active = pathname.startsWith(t.href);
        return (
          <Link
            key={t.href}
            href={t.href}
            aria-current={active ? "page" : undefined}
            className={`flex-1 whitespace-nowrap rounded-md px-1 py-1.5 text-center transition-colors ${
              active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"
            }`}
          >
            {t.label}
            {t.href === "/home/varsler" && unread > 0 && !active && (
              <span className="ml-0.5 rounded-full bg-accent px-1 text-[10px] font-semibold text-white">{unread}</span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}

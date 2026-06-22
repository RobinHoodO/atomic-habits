"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions";

const LINKS = [
  { href: "/", label: "Today" },
  { href: "/habits", label: "Habits" },
  { href: "/home", label: "Home" },
  { href: "/identities", label: "Identities" },
  { href: "/people", label: "People" },
  { href: "/progress", label: "Progress" },
  { href: "/leaderboard", label: "Ranks" },
  { href: "/challenges", label: "Challenges" },
  { href: "/learn", label: "Learn" },
];

// Responsive nav: inline links on >=md, a hamburger drawer on mobile so the 8
// destinations don't wrap into a chaotic pile on a phone. Closes on navigation.
export default function Nav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  if (!loggedIn) {
    return (
      <nav className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex max-w-3xl items-center gap-5 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold tracking-tight text-accent transition-opacity hover:opacity-80">⚛ Atomic Habits</Link>
          <Link href="/learn" className="text-muted transition-colors hover:text-foreground">Learn</Link>
          <Link href="/login" className="ml-auto text-muted transition-colors hover:text-foreground">Sign in</Link>
          <Link href="/register" className="btn btn-primary">Get started</Link>
        </div>
      </nav>
    );
  }

  return (
    <nav className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
      <div className="mx-auto flex max-w-3xl items-center gap-5 px-4 py-3 text-sm">
        <Link href="/" className="font-semibold tracking-tight text-accent transition-opacity hover:opacity-80">⚛ Atomic Habits</Link>

        {/* inline links — desktop */}
        <div className="hidden items-center gap-1 md:flex">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`rounded-md px-2 py-1 transition-colors ${
                pathname === l.href
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
        </div>

        <div className="ml-auto flex items-center gap-3">
          <Link href="/habits/new" className="btn btn-primary whitespace-nowrap">+ New</Link>
          <form action={logoutAction} className="hidden md:block">
            <button className="text-muted transition-colors hover:text-foreground">Sign out</button>
          </form>
          {/* hamburger — mobile only */}
          <button
            onClick={() => setOpen((v) => !v)}
            aria-label="Menu"
            aria-expanded={open}
            className="text-xl leading-none text-muted hover:text-foreground md:hidden"
          >
            {open ? "✕" : "☰"}
          </button>
        </div>
      </div>

      {/* mobile drawer */}
      {open && (
        <div className="mx-auto flex max-w-3xl flex-col gap-1 px-4 pb-3 text-sm md:hidden">
          {LINKS.map((l) => (
            <Link
              key={l.href}
              href={l.href}
              aria-current={pathname === l.href ? "page" : undefined}
              className={`rounded-md px-2.5 py-2 transition-colors ${
                pathname === l.href
                  ? "bg-accent-soft font-medium text-accent"
                  : "text-muted hover:bg-surface-2 hover:text-foreground"
              }`}
            >
              {l.label}
            </Link>
          ))}
          <form action={logoutAction}>
            <button className="px-2 py-2 text-muted hover:text-foreground">Sign out</button>
          </form>
        </div>
      )}
    </nav>
  );
}

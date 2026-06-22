"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { useEffect, useState } from "react";
import { logoutAction } from "@/app/actions";

// Information architecture (research-backed — see INFO-ARCHITECTURE.md):
// 3–5 primary destinations; everything else grouped behind progressive
// disclosure ("More"), chunked into ≤5 labelled groups (Miller's law).
const PRIMARY = [
  { href: "/", label: "Today" },
  { href: "/habits", label: "Habits" },
  { href: "/home", label: "Home" },
];

const GROUPS: { label: string; items: { href: string; label: string }[] }[] = [
  { label: "You", items: [{ href: "/identities", label: "Identities" }, { href: "/progress", label: "Progress" }] },
  { label: "Together", items: [{ href: "/people", label: "People" }, { href: "/leaderboard", label: "Ranks" }, { href: "/challenges", label: "Challenges" }] },
  { label: "Learn", items: [{ href: "/learn", label: "Learn" }] },
];
const SECONDARY = GROUPS.flatMap((g) => g.items);

export default function Nav({ loggedIn }: { loggedIn: boolean }) {
  const pathname = usePathname();
  const [open, setOpen] = useState(false);
  useEffect(() => setOpen(false), [pathname]);

  const isActive = (href: string) => (href === "/" ? pathname === "/" : pathname.startsWith(href));
  const onSecondary = SECONDARY.some((i) => isActive(i.href));

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

  const pill = (active: boolean) =>
    `rounded-md px-2.5 py-1 transition-colors ${
      active ? "bg-accent-soft font-medium text-accent" : "text-muted hover:bg-surface-2 hover:text-foreground"
    }`;

  return (
    <>
      {/* ===== top bar ===== */}
      <nav className="sticky top-0 z-30 border-b border-border bg-surface/80 backdrop-blur-md backdrop-saturate-150">
        <div className="mx-auto flex max-w-3xl items-center gap-5 px-4 py-3 text-sm">
          <Link href="/" className="font-semibold tracking-tight text-accent transition-opacity hover:opacity-80">⚛ Atomic Habits</Link>

          {/* desktop: primary inline + More dropdown */}
          <div className="relative hidden items-center gap-1 md:flex">
            {PRIMARY.map((l) => (
              <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined} className={pill(isActive(l.href))}>
                {l.label}
              </Link>
            ))}
            <button onClick={() => setOpen((v) => !v)} aria-expanded={open} className={pill(onSecondary)}>
              More ▾
            </button>
            {open && (
              <>
                <div className="fixed inset-0 z-10" onClick={() => setOpen(false)} />
                <div className="absolute left-[calc(100%-1rem)] top-9 z-20 w-52 rounded-xl border border-border bg-surface p-2 shadow-[var(--shadow)]">
                  {GROUPS.map((g) => (
                    <div key={g.label} className="px-1 py-1">
                      <div className="px-2 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{g.label}</div>
                      {g.items.map((i) => (
                        <Link key={i.href} href={i.href} className={`block ${pill(isActive(i.href))}`}>{i.label}</Link>
                      ))}
                    </div>
                  ))}
                </div>
              </>
            )}
          </div>

          <div className="ml-auto flex items-center gap-3">
            <Link href="/habits/new" className="btn btn-primary whitespace-nowrap">+ New</Link>
            <form action={logoutAction} className="hidden md:block">
              <button className="text-muted transition-colors hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      </nav>

      {/* ===== mobile bottom tab bar ===== */}
      <nav className="fixed inset-x-0 bottom-0 z-30 border-t border-border bg-surface/90 backdrop-blur-md pb-[env(safe-area-inset-bottom)] md:hidden">
        <div className="mx-auto grid max-w-3xl grid-cols-4 text-xs">
          {PRIMARY.map((l) => (
            <Link key={l.href} href={l.href} aria-current={isActive(l.href) ? "page" : undefined}
              className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${isActive(l.href) ? "text-accent" : "text-muted"}`}>
              {l.label}
            </Link>
          ))}
          <button onClick={() => setOpen((v) => !v)} aria-expanded={open}
            className={`flex flex-col items-center gap-0.5 py-2.5 transition-colors ${onSecondary || open ? "text-accent" : "text-muted"}`}>
            More
          </button>
        </div>
      </nav>

      {/* ===== mobile "More" sheet ===== */}
      {open && (
        <div className="fixed inset-0 z-40 md:hidden" onClick={() => setOpen(false)}>
          <div className="absolute inset-0 bg-foreground/20" />
          <div className="absolute inset-x-0 bottom-0 rounded-t-2xl border-t border-border bg-surface p-4 pb-[calc(env(safe-area-inset-bottom)+1rem)]" onClick={(e) => e.stopPropagation()}>
            <div className="mx-auto mb-3 h-1 w-10 rounded-full bg-border" />
            {GROUPS.map((g) => (
              <div key={g.label} className="mb-3">
                <div className="px-1 pb-1 text-[0.65rem] font-semibold uppercase tracking-wide text-muted">{g.label}</div>
                <div className="flex flex-col">
                  {g.items.map((i) => (
                    <Link key={i.href} href={i.href} className={`rounded-md px-2.5 py-2.5 ${isActive(i.href) ? "bg-accent-soft font-medium text-accent" : "hover:bg-surface-2"}`}>{i.label}</Link>
                  ))}
                </div>
              </div>
            ))}
            <form action={logoutAction}>
              <button className="px-2.5 py-2 text-sm text-muted hover:text-foreground">Sign out</button>
            </form>
          </div>
        </div>
      )}
    </>
  );
}

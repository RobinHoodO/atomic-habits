import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import Link from "next/link";
import "./globals.css";
import { currentUser } from "@/lib/session";
import { logoutAction } from "@/app/actions";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atomic Habits",
  description: "A habit tracker built on James Clear's Atomic Habits framework",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen">
        <nav className="border-b border-border bg-surface">
          <div className="mx-auto flex max-w-3xl flex-wrap items-center gap-x-4 gap-y-1 px-4 py-3 text-sm">
            <Link href="/" className="font-semibold text-accent">⚛ Atomic Habits</Link>
            {user ? (
              <>
                <Link href="/" className="text-muted hover:text-foreground">Today</Link>
                <Link href="/habits" className="text-muted hover:text-foreground">Habits</Link>
                <Link href="/identities" className="text-muted hover:text-foreground">Identities</Link>
                <Link href="/people" className="text-muted hover:text-foreground">People</Link>
                <Link href="/progress" className="text-muted hover:text-foreground">Progress</Link>
                <Link href="/leaderboard" className="text-muted hover:text-foreground">Ranks</Link>
                <Link href="/challenges" className="text-muted hover:text-foreground">Challenges</Link>
                <Link href="/learn" className="text-muted hover:text-foreground">Learn</Link>
                <div className="ml-auto flex items-center gap-3">
                  <Link href="/habits/new" className="btn btn-primary">+ New habit</Link>
                  <form action={logoutAction}>
                    <button className="text-muted hover:text-foreground">Sign out</button>
                  </form>
                </div>
              </>
            ) : (
              <>
                <Link href="/learn" className="text-muted hover:text-foreground">Learn</Link>
                <Link href="/login" className="ml-auto text-muted hover:text-foreground">Sign in</Link>
                <Link href="/register" className="btn btn-primary">Get started</Link>
              </>
            )}
          </div>
        </nav>
        <main className="mx-auto max-w-3xl px-4 py-6">{children}</main>
      </body>
    </html>
  );
}

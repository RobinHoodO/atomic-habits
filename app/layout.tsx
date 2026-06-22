import type { Metadata, Viewport } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";
import { currentUser } from "@/lib/session";
import Nav from "@/components/Nav";
import PWA from "@/components/PWA";

const geistSans = Geist({ variable: "--font-geist-sans", subsets: ["latin"] });
const geistMono = Geist_Mono({ variable: "--font-geist-mono", subsets: ["latin"] });

export const metadata: Metadata = {
  title: "Atomic Habits",
  description: "A habit tracker built on James Clear's Atomic Habits framework",
  appleWebApp: { capable: true, title: "Atomic Habits", statusBarStyle: "default" },
  icons: { icon: "/icon-192.png", apple: "/apple-touch-icon.png" },
};

export const viewport: Viewport = {
  themeColor: "#4f46e5",
  width: "device-width",
  initialScale: 1,
  viewportFit: "cover",
};

export default async function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  const user = await currentUser();

  return (
    <html lang="en" className={`${geistSans.variable} ${geistMono.variable} antialiased`}>
      <body className="min-h-screen">
        <Nav loggedIn={!!user} />
        <main className="mx-auto max-w-3xl px-4 pt-8 pb-[max(2rem,env(safe-area-inset-bottom))]">{children}</main>
        <PWA />
      </body>
    </html>
  );
}

import "server-only";
import { redirect } from "next/navigation";
import { auth } from "./auth";

export interface SessionUser {
  id: number;
  name: string;
  email: string;
}

// Gate a protected page/action: returns the current user or redirects to /login.
// We gate here (not in proxy.ts/middleware) — simpler and avoids Next 16's
// middleware→proxy rename uncertainty. ponytail: explicit > magic.
export async function requireUser(): Promise<SessionUser> {
  const session = await auth();
  if (!session?.user?.id) redirect("/login");
  return {
    id: Number(session.user.id),
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

// For places that may or may not have a user (e.g. public Learn pages).
export async function currentUser(): Promise<SessionUser | null> {
  const session = await auth();
  if (!session?.user?.id) return null;
  return {
    id: Number(session.user.id),
    name: session.user.name ?? "",
    email: session.user.email ?? "",
  };
}

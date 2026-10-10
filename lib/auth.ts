import NextAuth from "next-auth";
import Credentials from "next-auth/providers/credentials";
import bcrypt from "bcryptjs";
import { getUserByEmail } from "./users";

export const { handlers, auth, signIn, signOut } = NextAuth({
  // self-hosted: we control the host, so trust it (needed in production/start).
  trustHost: true,
  // keep people signed in across browser restarts (30 days)
  session: { strategy: "jwt", maxAge: 60 * 60 * 24 * 30 },
  pages: { signIn: "/login" },
  providers: [
    Credentials({
      credentials: {
        email: { label: "Email", type: "email" },
        password: { label: "Password", type: "password" },
      },
      authorize: async (creds) => {
        const email = String(creds?.email ?? "").trim().toLowerCase();
        const password = String(creds?.password ?? "");
        if (!email || !password) return null;
        // Workers Rate Limiting binding (wrangler.jsonc); no-op locally / when absent.
        try {
          const { getCloudflareContext } = await import("@opennextjs/cloudflare");
          const limiter = (getCloudflareContext().env as { AUTH_LIMITER?: { limit(o: { key: string }): Promise<{ success: boolean }> } })
            .AUTH_LIMITER;
          if (limiter && !(await limiter.limit({ key: email })).success) return null;
        } catch {
          // not running on Workers
        }
        const user = await getUserByEmail(email);
        if (!user) return null;
        const ok = await bcrypt.compare(password, user.password_hash);
        if (!ok) return null;
        return { id: String(user.id), name: user.name, email: user.email };
      },
    }),
  ],
  callbacks: {
    jwt({ token, user }) {
      if (user) token.id = (user as { id: string }).id;
      return token;
    },
    session({ session, token }) {
      if (session.user && token.id) session.user.id = token.id as string;
      return session;
    },
  },
});

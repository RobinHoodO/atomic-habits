import Link from "next/link";
import { redirect } from "next/navigation";
import { loginAction } from "@/app/actions";
import { currentUser } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="mx-auto mt-12 max-w-sm sm:mt-16">
      <h1 className="text-2xl font-bold tracking-tight">Welcome back</h1>
      <p className="mt-1.5 text-sm text-muted">Sign in to your habits.</p>

      {error && (
        <p className="mt-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          Invalid email or password.
        </p>
      )}

      <form action={loginAction} className="card mt-6 flex flex-col gap-4 p-6">
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" name="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" name="password" data-label="your password" required autoComplete="current-password" />
        </div>
        <SubmitButton>Sign in</SubmitButton>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        No account? <Link href="/register" className="text-accent">Create one</Link>
      </p>
    </div>
  );
}

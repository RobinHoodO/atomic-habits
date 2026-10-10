import Link from "next/link";
import { redirect } from "next/navigation";
import { registerAction } from "@/app/actions";
import { currentUser } from "@/lib/session";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

const ERRORS: Record<string, string> = {
  exists: "An account with that email already exists.",
  short: "Password must be at least 8 characters.",
  server: "Something went wrong. Please try again.",
};

export default async function RegisterPage({
  searchParams,
}: {
  searchParams: Promise<{ error?: string }>;
}) {
  if (await currentUser()) redirect("/");
  const { error } = await searchParams;

  return (
    <div className="mx-auto mt-12 max-w-sm sm:mt-16">
      <h1 className="text-2xl font-bold tracking-tight">Create your account</h1>
      <p className="mt-1.5 text-sm text-muted">Start casting votes for who you want to become.</p>

      {error && ERRORS[error] && (
        <p className="mt-4 rounded-md border border-bad/40 bg-bad/10 px-3 py-2 text-sm text-bad">
          {ERRORS[error]}
        </p>
      )}

      <form action={registerAction} className="card mt-6 flex flex-col gap-4 p-6">
        <div>
          <label className="label">Name</label>
          <input className="input" name="name" required autoComplete="name" />
        </div>
        <div>
          <label className="label">Email</label>
          <input className="input" type="email" name="email" required autoComplete="email" />
        </div>
        <div>
          <label className="label">Password</label>
          <input className="input" type="password" name="password" required minLength={8} autoComplete="new-password" />
          <p className="mt-1 text-xs text-muted">At least 8 characters.</p>
        </div>
        <SubmitButton>Create account</SubmitButton>
      </form>

      <p className="mt-4 text-center text-sm text-muted">
        Already have an account? <Link href="/login" className="text-accent">Sign in</Link>
      </p>
    </div>
  );
}

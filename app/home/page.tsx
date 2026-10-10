import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { homeForUser } from "@/lib/home";
import { createHomeAction } from "@/app/home-actions";

export const dynamic = "force-dynamic";

// Hjem: make a home once; after that this tab opens on Rutiner.
// Today's Home things live on the start page (I dag).
export default async function HomePage() {
  const user = await requireUser();
  if (await homeForUser(user.id)) redirect("/home/chores");

  return (
    <div className="mx-auto flex max-w-md flex-col gap-4">
      <header>
        <h1 className="text-2xl font-bold tracking-tight">Vårt hjem</h1>
        <p className="mt-1 text-sm leading-relaxed text-muted">Rutiner og oppgaver for oss to, i samme liste som vanene dine.</p>
      </header>
      <form action={createHomeAction} className="card flex flex-col gap-3">
        <div>
          <label className="label req">Navn på hjemmet</label>
          <input className="input" name="name" placeholder="Vårt hjem" required />
        </div>
        <button className="btn btn-primary self-start">Lag hjem</button>
      </form>
    </div>
  );
}

import Link from "next/link";
import { listIdentities } from "@/lib/habits";
import { createHabitAction } from "@/app/actions";
import { requireUser } from "@/lib/session";
import HabitFormFields from "@/components/HabitFormFields";
import SubmitButton from "@/components/SubmitButton";
import NewHabitCoach from "@/components/NewHabitCoach";

export const dynamic = "force-dynamic";

export default async function NewHabitPage() {
  const user = await requireUser();
  const identities = await listIdentities(user.id);
  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">New habit</h1>
      <NewHabitCoach>
        <form action={createHabitAction} className="card">
          <HabitFormFields identities={identities} />
          <div className="mt-5 flex gap-2">
            <SubmitButton>Create habit</SubmitButton>
            <Link href="/habits" className="btn">Cancel</Link>
          </div>
        </form>
      </NewHabitCoach>
    </div>
  );
}

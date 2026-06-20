import Link from "next/link";
import { notFound } from "next/navigation";
import { getHabit, listIdentities, AuthzError } from "@/lib/habits";
import { updateHabitAction } from "@/app/actions";
import { requireUser } from "@/lib/session";
import HabitFormFields from "@/components/HabitFormFields";
import SubmitButton from "@/components/SubmitButton";

export const dynamic = "force-dynamic";

export default async function EditHabitPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const user = await requireUser();
  const { id } = await params;
  let habit;
  try {
    habit = getHabit(Number(id), user.id);
  } catch (e) {
    if (e instanceof AuthzError) notFound();
    throw e;
  }
  const identities = listIdentities(user.id);

  return (
    <div className="flex flex-col gap-4">
      <h1 className="text-xl font-bold">Edit habit</h1>
      <form action={updateHabitAction} className="card">
        <input type="hidden" name="id" value={habit.id} />
        <HabitFormFields habit={habit} identities={identities} />
        <div className="mt-5 flex gap-2">
          <SubmitButton>Save</SubmitButton>
          <Link href={`/habits/${habit.id}`} className="btn">Cancel</Link>
        </div>
      </form>
    </div>
  );
}

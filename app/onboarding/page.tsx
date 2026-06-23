import { redirect } from "next/navigation";
import { requireUser } from "@/lib/session";
import { listHabits } from "@/lib/habits";
import OnboardingWizard from "@/components/OnboardingWizard";

export const dynamic = "force-dynamic";

export default async function OnboardingPage() {
  const user = await requireUser();
  // already set up → no need to onboard again
  if ((await listHabits(user.id, true)).length > 0) redirect("/");
  return <OnboardingWizard userName={user.name} />;
}

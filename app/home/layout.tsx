import HomeTabs from "@/components/HomeTabs";
import { requireUser } from "@/lib/session";
import { homeForUser, getSeenAt, unreadHomeEvents } from "@/lib/home";

export default async function HomeLayout({ children }: { children: React.ReactNode }) {
  const user = await requireUser();
  const home = await homeForUser(user.id);
  const unread = home ? (await unreadHomeEvents(home.id, user.id, await getSeenAt(home.id, user.id))).length : 0;
  return (
    <>
      <HomeTabs unread={unread} />
      {children}
    </>
  );
}

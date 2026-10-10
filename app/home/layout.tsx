import HomeTabs from "@/components/HomeTabs";

export default function HomeLayout({ children }: { children: React.ReactNode }) {
  return (
    <>
      <HomeTabs />
      {children}
    </>
  );
}

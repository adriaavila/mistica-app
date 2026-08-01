import BottomNav from "@/components/layout/BottomNav";
import SideNav from "@/components/layout/SideNav";
import InstallBanner from "@/components/InstallBanner";
import DataInitializer from "@/components/DataInitializer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]" style={{ position: "relative", background: "var(--surface)" }}>
      <DataInitializer />
      <SideNav />
      {/* ponytail: 820px reading column on desktop keeps the existing card pages sane
          until they get their own layouts; full-bleed pages use the (crm) group. */}
      <main
        className="mx-auto w-full max-w-[480px] flex-1 pb-20 md:pb-8 lg:max-w-[820px] lg:pb-8"
        style={{ minHeight: "100dvh" }}
      >
        {children}
      </main>
      <BottomNav />
      <InstallBanner />
    </div>
  );
}

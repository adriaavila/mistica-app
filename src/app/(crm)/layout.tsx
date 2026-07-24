import BottomNav from "@/components/layout/BottomNav";
import SideNav from "@/components/layout/SideNav";

// Separate from the (app) group on purpose: the inbox needs the full viewport
// width, not the 480/820px reading column the card pages use.
export default function CrmLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-[100dvh]" style={{ background: "var(--surface)" }}>
      <SideNav />
      <main className="min-w-0 flex-1 pb-20 lg:pb-0">{children}</main>
      <BottomNav />
    </div>
  );
}

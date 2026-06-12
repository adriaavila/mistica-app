import BottomNav from "@/components/layout/BottomNav";
import InstallBanner from "@/components/InstallBanner";
import DataInitializer from "@/components/DataInitializer";

export default function AppLayout({ children }: { children: React.ReactNode }) {
  return (
    <div style={{ maxWidth: 480, margin: "0 auto", minHeight: "100dvh", position: "relative", background: "var(--surface)" }}>
      <DataInitializer />
      <main style={{ minHeight: "100dvh", paddingBottom: 80 }}>
        {children}
      </main>
      <BottomNav />
      <InstallBanner />
    </div>
  );
}

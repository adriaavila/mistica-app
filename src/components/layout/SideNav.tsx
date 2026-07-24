"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { NAV_ITEMS, CRM_NAV_ITEMS, isNavItemActive } from "./nav-items";

export default function SideNav() {
  const pathname = usePathname();
  const stats = useQuery(api.payments.getDashboardStats);
  const overdueCount = stats?.overdueCount ?? 0;

  return (
    <nav
      className="hidden lg:flex lg:sticky lg:top-0 lg:h-[100dvh] lg:w-[240px] lg:shrink-0 lg:flex-col"
      style={{ background: "var(--white)", borderRight: "1px solid var(--border)", padding: "20px 12px" }}
    >
      <div style={{ padding: "0 12px 20px", fontSize: 18, fontWeight: 800, color: "var(--pool-blue)", fontFamily: "var(--font)" }}>
        Mística
      </div>

      <div style={{ display: "flex", flexDirection: "column", gap: 2 }}>
        {[...NAV_ITEMS, ...CRM_NAV_ITEMS].map(item => {
          const active = isNavItemActive(pathname, item.href);
          const showBadge = item.badge && overdueCount > 0;
          return (
            <Link key={item.href} href={item.href} style={{
              display: "flex", alignItems: "center", gap: 12,
              padding: "10px 12px", borderRadius: 10,
              background: active ? "var(--pool-light)" : "transparent",
              color: active ? "var(--pool-blue)" : "var(--text-secondary)",
              fontSize: 14, fontWeight: active ? 700 : 500,
              fontFamily: "var(--font)", textDecoration: "none",
            }}>
              <span style={{ fontSize: 18, width: 20, textAlign: "center" }}>{item.icon}</span>
              <span style={{ flex: 1 }}>{item.label}</span>
              {showBadge && (
                <span style={{
                  minWidth: 20, height: 20, borderRadius: 99,
                  background: "var(--overdue-coral)", color: "#fff",
                  fontSize: 11, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center", padding: "0 6px",
                }}>
                  {overdueCount > 99 ? "99+" : overdueCount}
                </span>
              )}
            </Link>
          );
        })}
      </div>
    </nav>
  );
}

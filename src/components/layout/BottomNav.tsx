"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

const TABS = [
  { href: "/",           label: "Inicio",     icon: "⊞" },
  { href: "/alumnos",    label: "Alumnos",    icon: "◎" },
  { href: "/cobros",     label: "Cobros",     icon: "◈", badge: true },
  { href: "/asistencia", label: "Asistencia", icon: "◷" },
  { href: "/mas",        label: "Más",        icon: "≡" },
];

export default function BottomNav() {
  const pathname = usePathname();
  const stats = useQuery(api.payments.getDashboardStats);
  const overdueCount = stats?.overdueCount ?? 0;

  return (
    <nav style={{
      position: "fixed", bottom: 0, left: "50%", transform: "translateX(-50%)",
      width: "100%", maxWidth: 480,
      background: "rgba(255,255,255,0.95)", backdropFilter: "blur(12px)",
      borderTop: "1px solid var(--border)",
      display: "flex", alignItems: "flex-end", justifyContent: "space-around",
      padding: "6px 4px calc(10px + env(safe-area-inset-bottom))",
      zIndex: 50, boxShadow: "0 -2px 20px rgba(0,0,0,0.06)",
    }}>
      {TABS.map(tab => {
        const active = tab.href === "/" ? pathname === "/" : pathname === tab.href || pathname.startsWith(tab.href + "/");
        const showBadge = tab.badge && overdueCount > 0;
        return (
          <Link key={tab.href} href={tab.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: active ? "var(--pool-blue)" : "var(--text-secondary)",
            fontSize: 10, fontWeight: active ? 700 : 500,
            minWidth: 56, textDecoration: "none", padding: "0 4px",
            transition: "color 0.15s ease",
          }}>
            <span style={{
              width: 44, height: 30, borderRadius: 99, position: "relative",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
              background: active ? "var(--pool-light)" : "transparent",
              transition: "background 0.15s ease",
            }}>
              {tab.icon}
              {showBadge && (
                <span style={{
                  position: "absolute", top: 1, right: 5,
                  minWidth: 16, height: 16, borderRadius: 99,
                  background: "var(--overdue-coral)", color: "#fff",
                  fontSize: 9, fontWeight: 800,
                  display: "flex", alignItems: "center", justifyContent: "center",
                  padding: "0 4px", border: "1.5px solid #fff",
                }}>
                  {overdueCount > 99 ? "99+" : overdueCount}
                </span>
              )}
            </span>
            <span style={{ fontFamily: "var(--font)" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

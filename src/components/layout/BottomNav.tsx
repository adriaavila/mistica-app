"use client";
import Link from "next/link";
import { usePathname } from "next/navigation";

const TABS = [
  { href: "/",            label: "Inicio",      icon: "⊞" },
  { href: "/alumnos",     label: "Alumnos",      icon: "◎" },
  { href: "/cobros",      label: "Cobros",       icon: "◈" },
  { href: "/asistencia",  label: "Asistencia",   icon: "◷" },
  { href: "/mas",         label: "Más",          icon: "≡" },
];

export default function BottomNav() {
  const pathname = usePathname();

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
        return (
          <Link key={tab.href} href={tab.href} style={{
            display: "flex", flexDirection: "column", alignItems: "center", gap: 3,
            color: active ? "var(--pool-blue)" : "var(--text-secondary)",
            fontSize: 10, fontWeight: active ? 700 : 500,
            minWidth: 56, textDecoration: "none", padding: "0 4px",
            transition: "color 0.15s ease",
          }}>
            <span style={{
              width: 44, height: 30, borderRadius: 99,
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18,
              background: active ? "var(--pool-light)" : "transparent",
              transition: "background 0.15s ease",
            }}>{tab.icon}</span>
            <span style={{ fontFamily: "var(--font)" }}>{tab.label}</span>
          </Link>
        );
      })}
    </nav>
  );
}

"use client";
import { useRouter } from "next/navigation";
import React from "react";

export default function PageHeader({ title, subtitle, back, action }: {
  title: string; subtitle?: string; back?: boolean; action?: React.ReactNode;
}) {
  const router = useRouter();
  return (
    <div style={{
      padding: "16px 20px 12px",
      display: "flex", alignItems: "center", gap: 12,
      background: "var(--white)", borderBottom: "1px solid var(--border)",
      position: "sticky", top: 0, zIndex: 10,
    }}>
      {back && (
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, color: "var(--text-primary)", flexShrink: 0 }}>←</button>
      )}
      <div style={{ flex: 1 }}>
        <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", fontFamily: "var(--font)", lineHeight: 1.2 }}>{title}</div>
        {subtitle && <div style={{ fontSize: 13, color: "var(--text-secondary)", fontFamily: "var(--font)", marginTop: 2 }}>{subtitle}</div>}
      </div>
      {action && <div style={{ flexShrink: 0 }}>{action}</div>}
    </div>
  );
}

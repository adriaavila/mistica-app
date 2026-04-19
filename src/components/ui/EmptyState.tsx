import React from "react";

export default function EmptyState({ emoji, title, description, action }: {
  emoji: string; title: string; description?: string; action?: React.ReactNode;
}) {
  return (
    <div style={{
      display: "flex", flexDirection: "column", alignItems: "center",
      justifyContent: "center", padding: "48px 24px", textAlign: "center", gap: 12,
    }}>
      <div style={{ fontSize: 48, lineHeight: 1 }}>{emoji}</div>
      <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", fontFamily: "var(--font)" }}>{title}</div>
      {description && <div style={{ fontSize: 14, color: "var(--text-secondary)", fontFamily: "var(--font)", maxWidth: 260, lineHeight: 1.6 }}>{description}</div>}
      {action && <div style={{ marginTop: 8 }}>{action}</div>}
    </div>
  );
}

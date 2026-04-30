type BadgeVariant = "paid" | "pending" | "overdue" | "active" | "suspended" | "withdrawn" | "lmv" | "mj" | "aquagym3x" | "aquagym5x" | "nat5x";

const STYLES: Record<BadgeVariant, { bg: string; color: string }> = {
  paid:       { bg: "#DCFCE7", color: "#16A34A" },
  pending:    { bg: "#FEF3C7", color: "#D97706" },
  overdue:    { bg: "#FEE2E2", color: "#DC2626" },
  active:     { bg: "#E0F2FE", color: "#0284C7" },
  suspended:  { bg: "#FEF3C7", color: "#D97706" },
  withdrawn:  { bg: "#F1F5F9", color: "#6B7280" },
  lmv:        { bg: "#E0F2FE", color: "#0284C7" },
  mj:         { bg: "#F3E8FF", color: "#7E22CE" },
  aquagym3x:  { bg: "#DCFCE7", color: "#166534" },
  aquagym5x:  { bg: "#FFF7ED", color: "#9A3412" },
  nat5x:      { bg: "#FDF2F8", color: "#9D174D" },
};

const LABELS: Record<BadgeVariant, string> = {
  paid: "Pagado", pending: "Pendiente", overdue: "En mora",
  active: "Activo", suspended: "Suspendido", withdrawn: "Retirado",
  lmv: "LMV", mj: "MJ", aquagym3x: "AG 3x", aquagym5x: "AG 5x", nat5x: "N 5x",
};

export default function Badge({ variant, label, size = "md" }: {
  variant: BadgeVariant; label?: string; size?: "sm" | "md";
}) {
  const s = STYLES[variant];
  return (
    <span style={{
      display: "inline-flex", alignItems: "center", gap: 5,
      fontSize: size === "sm" ? 11 : 12, fontWeight: 600,
      padding: size === "sm" ? "3px 8px" : "4px 10px",
      borderRadius: 9999, background: s.bg, color: s.color,
      whiteSpace: "nowrap", fontFamily: "var(--font)",
    }}>
      <span style={{ width: 6, height: 6, borderRadius: "50%", background: s.color, display: "inline-block", flexShrink: 0 }} />
      {label ?? LABELS[variant]}
    </span>
  );
}

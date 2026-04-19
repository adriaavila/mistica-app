import React from "react";

interface ButtonProps extends React.ButtonHTMLAttributes<HTMLButtonElement> {
  variant?: "primary" | "brand" | "outline" | "ghost" | "danger";
  size?: "sm" | "md" | "lg";
  fullWidth?: boolean;
  loading?: boolean;
}

const VARIANTS = {
  primary: { background: "#1A1A2E", color: "#fff", border: "none" },
  brand:   { background: "#0EA5E9", color: "#fff", border: "none" },
  outline: { background: "transparent", color: "#1A1A2E", border: "1.5px solid #E2E8F0" },
  ghost:   { background: "transparent", color: "#0EA5E9", border: "none" },
  danger:  { background: "#DC2626", color: "#fff", border: "none" },
};

const SIZES = {
  sm: { fontSize: 13, padding: "0 14px", height: 36, borderRadius: 8 },
  md: { fontSize: 14, padding: "0 20px", height: 44, borderRadius: 10 },
  lg: { fontSize: 15, padding: "0 24px", height: 52, borderRadius: 14 },
};

export default function Button({ variant = "primary", size = "md", fullWidth, loading, children, style, disabled, ...props }: ButtonProps) {
  return (
    <button
      disabled={disabled || loading}
      style={{
        display: "inline-flex", alignItems: "center", justifyContent: "center",
        gap: 6, fontFamily: "var(--font)", fontWeight: 600,
        cursor: disabled || loading ? "not-allowed" : "pointer",
        opacity: disabled || loading ? 0.55 : 1,
        transition: "all 0.15s ease", whiteSpace: "nowrap",
        width: fullWidth ? "100%" : undefined,
        ...VARIANTS[variant], ...SIZES[size], ...style,
      }}
      {...props}
    >
      {loading ? <span style={{ opacity: 0.7 }}>...</span> : children}
    </button>
  );
}

import React from "react";

interface CardProps {
  children: React.ReactNode;
  style?: React.CSSProperties;
  onClick?: () => void;
  variant?: "default" | "overdue" | "flat";
  padding?: string | number;
}

export default function Card({ children, style, onClick, variant = "default", padding = "16px" }: CardProps) {
  return (
    <div
      onClick={onClick}
      role={onClick ? "button" : undefined}
      style={{
        background: "var(--white)", borderRadius: 20,
        boxShadow: variant === "flat" ? "none" : "var(--shadow-card)",
        overflow: "hidden",
        borderLeft: variant === "overdue" ? "3px solid var(--overdue-coral)" : undefined,
        border: variant === "flat" ? "1px solid var(--border)" : undefined,
        cursor: onClick ? "pointer" : undefined,
        transition: onClick ? "box-shadow 0.2s ease, transform 0.15s ease" : undefined,
        padding,
        ...style,
      }}
      onMouseEnter={onClick ? e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "var(--shadow-hover)"; el.style.transform = "translateY(-1px)"; } : undefined}
      onMouseLeave={onClick ? e => { const el = e.currentTarget as HTMLDivElement; el.style.boxShadow = "var(--shadow-card)"; el.style.transform = "translateY(0)"; } : undefined}
    >
      {children}
    </div>
  );
}

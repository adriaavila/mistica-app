import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, hint, error, options, style, ...props }: SelectProps) {
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font)" }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select
          style={{
            fontFamily: "var(--font)", fontSize: 15, color: "var(--text-primary)",
            background: "var(--white)", border: `1.5px solid ${error ? "var(--overdue-coral)" : "var(--border)"}`,
            borderRadius: 14, padding: "0 36px 0 16px", height: 52, width: "100%",
            outline: "none", appearance: "none", cursor: "pointer",
            ...style,
          }}
          {...props}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none", fontSize: 12 }}>▾</span>
      </div>
      {(hint || error) && <span style={{ fontSize: 12, color: error ? "var(--overdue-coral)" : "var(--text-secondary)", fontFamily: "var(--font)" }}>{error ?? hint}</span>}
    </div>
  );
}

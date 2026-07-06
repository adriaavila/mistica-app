import React from "react";

interface SelectProps extends React.SelectHTMLAttributes<HTMLSelectElement> {
  label?: string;
  hint?: string;
  error?: string;
  options: { value: string; label: string }[];
}

export default function Select({ label, hint, error, options, style, onFocus, onBlur, ...props }: SelectProps) {
  const generatedId = React.useId();
  const id = props.id ?? props.name ?? generatedId;
  const messageId = hint || error ? `${id}-message` : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font)" }}>{label}</label>}
      <div style={{ position: "relative" }}>
        <select
          id={id}
          aria-invalid={error ? true : undefined}
          aria-describedby={messageId}
          style={{
            fontFamily: "var(--font)", fontSize: 15, color: "var(--text-primary)",
            background: "var(--white)", border: `1.5px solid ${error ? "var(--overdue-coral)" : "var(--border)"}`,
            borderRadius: 14, padding: "0 36px 0 16px", height: 52, width: "100%",
            outline: "none", appearance: "none", cursor: "pointer",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
            ...style,
          }}
          {...props}
          onFocus={e => { e.target.style.borderColor = "var(--pool-blue)"; e.target.style.boxShadow = "var(--shadow-focus)"; onFocus?.(e); }}
          onBlur={e => { e.target.style.borderColor = error ? "var(--overdue-coral)" : "var(--border)"; e.target.style.boxShadow = "none"; onBlur?.(e); }}
        >
          {options.map(o => <option key={o.value} value={o.value}>{o.label}</option>)}
        </select>
        <span style={{ position: "absolute", right: 14, top: "50%", transform: "translateY(-50%)", color: "var(--text-secondary)", pointerEvents: "none", fontSize: 12 }}>▾</span>
      </div>
      {(hint || error) && <span id={messageId} aria-live="polite" style={{ fontSize: 12, color: error ? "var(--overdue-coral)" : "var(--text-secondary)", fontFamily: "var(--font)" }}>{error ?? hint}</span>}
    </div>
  );
}

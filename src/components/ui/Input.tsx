import React from "react";

interface InputProps extends React.InputHTMLAttributes<HTMLInputElement> {
  label?: string;
  hint?: string;
  error?: string;
}

export default function Input({ label, hint, error, style, onFocus, onBlur, ...props }: InputProps) {
  const generatedId = React.useId();
  const id = props.id ?? props.name ?? generatedId;
  const messageId = hint || error ? `${id}-message` : undefined;
  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
      {label && <label htmlFor={id} style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)", fontFamily: "var(--font)" }}>{label}</label>}
      <input
        id={id}
        aria-invalid={error ? true : undefined}
        aria-describedby={messageId}
        style={{
          fontFamily: "var(--font)", fontSize: 15, color: "var(--text-primary)",
          background: "var(--white)", border: `1.5px solid ${error ? "var(--overdue-coral)" : "var(--border)"}`,
          borderRadius: 14, padding: "0 16px", height: 52, width: "100%",
          outline: "none", transition: "border-color 0.15s ease, box-shadow 0.15s ease, background-color 0.15s ease",
          ...style,
        }}
        {...props}
        onFocus={e => { e.target.style.borderColor = "var(--pool-blue)"; e.target.style.boxShadow = "var(--shadow-focus)"; onFocus?.(e); }}
        onBlur={e => { e.target.style.borderColor = error ? "var(--overdue-coral)" : "var(--border)"; e.target.style.boxShadow = "none"; onBlur?.(e); }}
      />
      {(hint || error) && <span id={messageId} aria-live="polite" style={{ fontSize: 12, color: error ? "var(--overdue-coral)" : "var(--text-secondary)", fontFamily: "var(--font)" }}>{error ?? hint}</span>}
    </div>
  );
}

export default function SegmentedControl({ options, value, onChange, fullWidth }: {
  options: { value: string; label: string }[];
  value: string;
  onChange: (v: string) => void;
  fullWidth?: boolean;
}) {
  return (
    <div style={{
      display: "inline-flex", background: "var(--surface-2)",
      borderRadius: 14, padding: 3, gap: 2,
      width: fullWidth ? "100%" : undefined,
    }}>
      {options.map(opt => (
        <button
          type="button"
          key={opt.value}
          aria-pressed={opt.value === value}
          onClick={() => onChange(opt.value)}
          style={{
            fontFamily: "var(--font)", fontSize: 13,
            fontWeight: opt.value === value ? 600 : 500,
            color: opt.value === value ? "var(--text-primary)" : "var(--text-secondary)",
            background: opt.value === value ? "var(--white)" : "transparent",
            border: "none", borderRadius: 10,
            padding: "7px 14px", cursor: "pointer",
            transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
            whiteSpace: "nowrap",
            flex: fullWidth ? 1 : undefined,
            boxShadow: opt.value === value ? "rgba(0,0,0,0.08) 0px 1px 6px" : "none",
          }}
          onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
          onBlur={e => { e.currentTarget.style.boxShadow = opt.value === value ? "rgba(0,0,0,0.08) 0px 1px 6px" : "none"; }}
        >{opt.label}</button>
      ))}
    </div>
  );
}

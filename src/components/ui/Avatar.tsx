import { getInitials } from "@/lib/utils";

const COLORS = [
  { bg: "#E0F2FE", color: "#0284C7" },
  { bg: "#DCFCE7", color: "#166534" },
  { bg: "#FEF3C7", color: "#92400E" },
  { bg: "#FEE2E2", color: "#991B1B" },
  { bg: "#F3E8FF", color: "#7E22CE" },
  { bg: "#FFF7ED", color: "#9A3412" },
  { bg: "#FCE7F3", color: "#9D174D" },
];

function nameColor(name: string) {
  let h = 0;
  for (let i = 0; i < name.length; i++) h = name.charCodeAt(i) + ((h << 5) - h);
  return COLORS[Math.abs(h) % COLORS.length];
}

export default function Avatar({ name, size = 44, fontSize }: { name: string; size?: number; fontSize?: number }) {
  const { bg, color } = nameColor(name);
  const fs = fontSize ?? Math.floor(size * 0.34);
  return (
    <div style={{
      width: size, height: size, borderRadius: "50%",
      background: bg, color, fontWeight: 700, fontSize: fs,
      display: "flex", alignItems: "center", justifyContent: "center",
      flexShrink: 0, fontFamily: "var(--font)",
    }}>
      {getInitials(name)}
    </div>
  );
}

"use client";
import { useQuery } from "convex/react";
import type { FunctionReturnType } from "convex/server";
import { api } from "../../../../convex/_generated/api";

type Analytics = NonNullable<FunctionReturnType<typeof api.payments.getAnalytics>>;
import { formatCurrency, formatMonth, MODALITY_LABELS, MODALITY_COLORS } from "@/lib/utils";
import Link from "next/link";

export default function DashboardPage() {
  const data = useQuery(api.payments.getAnalytics);

  return (
    <div style={{ fontFamily: "var(--font)", paddingBottom: 24 }}>
      <Header />

      {!data ? (
        <LoadingState />
      ) : (
        <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>
          <KpiGrid data={data} />
          <CollectionRateCard rate={data.collectionRate} collected={data.totalCollected} expected={data.totalExpected} />
          <RevenueChart data={data.monthlyRevenue} />
          <PaymentsBreakdown breakdown={data.paymentsBreakdown} />
          <ModalityDonut counts={data.modalityCounts} total={data.activeCount} />
          <AttendanceTrend trend={data.attendanceTrend} />
          <NewStudentsBars data={data.newStudentsByMonth} />
          <OccupancyList slots={data.occupancy} />
          <SalesCard sales={data.salesLast30Days} />
        </div>
      )}
    </div>
  );
}

/* ───────────── Header ───────────── */
function Header() {
  return (
    <div style={{ padding: "24px 20px 16px", background: "var(--white)", borderBottom: "1px solid var(--border)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
      <div>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Dashboard</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Métricas y tendencias</div>
      </div>
      <Link href="/" style={{ fontSize: 13, fontWeight: 600, color: "var(--pool-blue)" }}>← Inicio</Link>
    </div>
  );
}

function LoadingState() {
  return (
    <div style={{ padding: "40px 20px", textAlign: "center", color: "var(--text-secondary)" }}>
      <div style={{ fontSize: 28, marginBottom: 8 }}>📊</div>
      <div style={{ fontSize: 13 }}>Cargando datos…</div>
    </div>
  );
}

/* ───────────── KPI grid ───────────── */
function KpiGrid({ data }: { data: Analytics }) {
  const kpis = [
    { label: "Alumnos activos", value: data.activeCount, accent: "var(--pool-blue)", bg: "var(--pool-light)" },
    { label: "Cobrado / mes", value: formatCurrency(data.totalCollected), accent: "var(--paid-green)", bg: "var(--paid-light)" },
    { label: "En mora", value: data.paymentsBreakdown.overdue, accent: "var(--overdue-coral)", bg: "var(--overdue-light)" },
    { label: "Ventas 30d", value: formatCurrency(data.salesLast30Days.total), accent: "var(--pending-amber)", bg: "var(--pending-light)" },
  ];
  return (
    <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
      {kpis.map((k) => (
        <div key={k.label} style={{ background: "var(--white)", borderRadius: 20, padding: 14, boxShadow: "var(--shadow-card)", position: "relative", overflow: "hidden" }}>
          <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${k.bg} 0%, transparent 60%)`, opacity: 0.7 }} />
          <div style={{ position: "relative" }}>
            <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
            <div style={{ fontSize: 22, fontWeight: 800, color: k.accent, marginTop: 6, lineHeight: 1.1 }}>{k.value}</div>
          </div>
        </div>
      ))}
    </div>
  );
}

/* ───────────── Collection rate ring ───────────── */
function CollectionRateCard({ rate, collected, expected }: { rate: number; collected: number; expected: number }) {
  const size = 96;
  const stroke = 10;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;
  const dash = (rate / 100) * circ;

  return (
    <Card title="Tasa de cobranza (mes actual)">
      <div style={{ display: "flex", alignItems: "center", gap: 18 }}>
        <svg width={size} height={size}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          <circle
            cx={size / 2} cy={size / 2} r={r} fill="none"
            stroke="var(--paid-green)" strokeWidth={stroke} strokeLinecap="round"
            strokeDasharray={`${dash} ${circ}`}
            transform={`rotate(-90 ${size / 2} ${size / 2})`}
          />
          <text x="50%" y="50%" textAnchor="middle" dy="0.35em" fontSize="20" fontWeight="800" fill="var(--text-primary)">{rate}%</text>
        </svg>
        <div style={{ flex: 1 }}>
          <Row label="Cobrado" value={formatCurrency(collected)} color="var(--paid-green)" />
          <Row label="Esperado" value={formatCurrency(expected)} color="var(--text-primary)" />
          <Row label="Pendiente" value={formatCurrency(Math.max(0, expected - collected))} color="var(--pending-amber)" />
        </div>
      </div>
    </Card>
  );
}

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

/* ───────────── Revenue bar chart ───────────── */
function RevenueChart({ data }: { data: { month: string; total: number; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.total), 1);

  return (
    <Card title="Ingresos últimos 6 meses">
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 140, marginTop: 8 }}>
        {data.map((d) => {
          const h = Math.max(4, (d.total / max) * 110);
          const isCurrent = d === data[data.length - 1];
          const [, m] = d.month.split("-");
          const monthShort = ["Ene", "Feb", "Mar", "Abr", "May", "Jun", "Jul", "Ago", "Sep", "Oct", "Nov", "Dic"][parseInt(m) - 1];
          return (
            <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 6 }}>
              <div style={{ fontSize: 10, fontWeight: 700, color: isCurrent ? "var(--pool-deep)" : "var(--text-secondary)" }}>
                {d.total > 0 ? `${Math.round(d.total / 1000)}k` : "—"}
              </div>
              <div
                style={{
                  width: "100%",
                  height: h,
                  borderRadius: 8,
                  background: isCurrent
                    ? "linear-gradient(180deg, var(--pool-blue) 0%, var(--pool-deep) 100%)"
                    : "linear-gradient(180deg, #BAE6FD 0%, #7DD3FC 100%)",
                  transition: "all 0.3s",
                }}
              />
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>{monthShort}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────── Payments breakdown ───────────── */
function PaymentsBreakdown({ breakdown }: { breakdown: { paid: number; pending: number; overdue: number } }) {
  const total = breakdown.paid + breakdown.pending + breakdown.overdue;
  const items = [
    { label: "Pagados", value: breakdown.paid, color: "var(--paid-green)", bg: "var(--paid-light)" },
    { label: "Pendientes", value: breakdown.pending, color: "var(--pending-amber)", bg: "var(--pending-light)" },
    { label: "En mora", value: breakdown.overdue, color: "var(--overdue-coral)", bg: "var(--overdue-light)" },
  ];

  return (
    <Card title="Estado de cobros este mes">
      {/* Segmented bar */}
      <div style={{ display: "flex", height: 12, borderRadius: 99, overflow: "hidden", background: "var(--surface-2)", marginBottom: 14 }}>
        {items.map((it) =>
          it.value > 0 ? (
            <div key={it.label} style={{ flex: it.value, background: it.color }} />
          ) : null
        )}
      </div>
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {items.map((it) => (
          <div key={it.label} style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
              <span style={{ width: 10, height: 10, borderRadius: 99, background: it.color }} />
              <span style={{ fontSize: 13, color: "var(--text-primary)", fontWeight: 600 }}>{it.label}</span>
            </div>
            <div style={{ fontSize: 13, fontWeight: 700, color: it.color }}>
              {it.value} {total > 0 && <span style={{ color: "var(--text-secondary)", fontWeight: 500 }}>· {Math.round((it.value / total) * 100)}%</span>}
            </div>
          </div>
        ))}
      </div>
    </Card>
  );
}

/* ───────────── Modality donut ───────────── */
function ModalityDonut({ counts, total }: { counts: Record<string, number>; total: number }) {
  const size = 140;
  const stroke = 18;
  const r = (size - stroke) / 2;
  const circ = 2 * Math.PI * r;

  const keys = Object.keys(counts);
  let offset = 0;
  const segs = keys.map((k) => {
    const value = counts[k] ?? 0;
    const frac = total > 0 ? value / total : 0;
    const len = frac * circ;
    const seg = {
      key: k,
      value,
      dash: `${len} ${circ - len}`,
      offset,
      color: MODALITY_COLORS[k]?.color ?? "var(--pool-blue)",
    };
    offset -= len;
    return seg;
  });

  return (
    <Card title="Distribución por modalidad">
      <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
        <svg width={size} height={size} style={{ flexShrink: 0 }}>
          <circle cx={size / 2} cy={size / 2} r={r} fill="none" stroke="var(--surface-2)" strokeWidth={stroke} />
          {segs.map((s) => (
            <circle
              key={s.key}
              cx={size / 2}
              cy={size / 2}
              r={r}
              fill="none"
              stroke={s.color}
              strokeWidth={stroke}
              strokeDasharray={s.dash}
              strokeDashoffset={s.offset}
              transform={`rotate(-90 ${size / 2} ${size / 2})`}
            />
          ))}
          <text x="50%" y="47%" textAnchor="middle" fontSize="22" fontWeight="800" fill="var(--text-primary)">{total}</text>
          <text x="50%" y="62%" textAnchor="middle" fontSize="10" fontWeight="600" fill="var(--text-secondary)">activos</text>
        </svg>
        <div style={{ flex: 1, display: "flex", flexDirection: "column", gap: 6 }}>
          {segs.map((s) => (
            <div key={s.key} style={{ display: "flex", alignItems: "center", justifyContent: "space-between", fontSize: 12 }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                <span style={{ width: 10, height: 10, borderRadius: 3, background: s.color }} />
                <span style={{ color: "var(--text-primary)", fontWeight: 600 }}>{MODALITY_LABELS[s.key]}</span>
              </div>
              <span style={{ fontWeight: 700, color: s.color }}>{s.value}</span>
            </div>
          ))}
        </div>
      </div>
    </Card>
  );
}

/* ───────────── Attendance trend (sparkline) ───────────── */
function AttendanceTrend({ trend }: { trend: { date: string; present: number; absent: number }[] }) {
  const width = 320;
  const height = 100;
  const pad = 6;
  const max = Math.max(...trend.map((t) => t.present + t.absent), 1);

  const pts = trend.map((t, i) => {
    const x = pad + (i / (trend.length - 1)) * (width - pad * 2);
    const y = height - pad - (t.present / max) * (height - pad * 2);
    return `${x},${y}`;
  });

  const totalPresent = trend.reduce((s, t) => s + t.present, 0);
  const totalAll = trend.reduce((s, t) => s + t.present + t.absent, 0);
  const rate = totalAll > 0 ? Math.round((totalPresent / totalAll) * 100) : 0;

  return (
    <Card title="Asistencia últimos 14 días" right={`${rate}% asistencia`}>
      <svg viewBox={`0 0 ${width} ${height}`} style={{ width: "100%", height: 100, display: "block" }} preserveAspectRatio="none">
        <defs>
          <linearGradient id="attFill" x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor="var(--pool-blue)" stopOpacity="0.35" />
            <stop offset="100%" stopColor="var(--pool-blue)" stopOpacity="0" />
          </linearGradient>
        </defs>
        <polygon
          points={`${pad},${height - pad} ${pts.join(" ")} ${width - pad},${height - pad}`}
          fill="url(#attFill)"
        />
        <polyline points={pts.join(" ")} fill="none" stroke="var(--pool-blue)" strokeWidth="2.5" strokeLinejoin="round" strokeLinecap="round" />
        {trend.map((t, i) => {
          const x = pad + (i / (trend.length - 1)) * (width - pad * 2);
          const y = height - pad - (t.present / max) * (height - pad * 2);
          return <circle key={t.date} cx={x} cy={y} r={i === trend.length - 1 ? 3.5 : 1.5} fill="var(--pool-deep)" />;
        })}
      </svg>
      <div style={{ display: "flex", justifyContent: "space-between", marginTop: 4, fontSize: 10, color: "var(--text-secondary)" }}>
        <span>{formatShortDate(trend[0]?.date)}</span>
        <span>{formatShortDate(trend[trend.length - 1]?.date)}</span>
      </div>
    </Card>
  );
}

function formatShortDate(d?: string) {
  if (!d) return "";
  const dt = new Date(d + "T00:00:00");
  return dt.toLocaleDateString("es-VE", { day: "numeric", month: "short" });
}

/* ───────────── New students bars ───────────── */
function NewStudentsBars({ data }: { data: { month: string; count: number }[] }) {
  const max = Math.max(...data.map((d) => d.count), 1);
  const total = data.reduce((s, d) => s + d.count, 0);

  return (
    <Card title="Nuevas inscripciones" right={`${total} en 6 meses`}>
      <div style={{ display: "flex", alignItems: "flex-end", gap: 8, height: 80, marginTop: 6 }}>
        {data.map((d) => {
          const h = Math.max(3, (d.count / max) * 60);
          const [, m] = d.month.split("-");
          const label = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"][parseInt(m)-1];
          return (
            <div key={d.month} style={{ flex: 1, display: "flex", flexDirection: "column", alignItems: "center", gap: 4 }}>
              <div style={{ fontSize: 11, fontWeight: 700, color: "var(--text-primary)" }}>{d.count || ""}</div>
              <div style={{ width: "100%", height: h, borderRadius: 6, background: d.count > 0 ? "var(--paid-green)" : "var(--surface-2)" }} />
              <div style={{ fontSize: 10, color: "var(--text-secondary)", fontWeight: 600 }}>{label}</div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────── Occupancy list ───────────── */
function OccupancyList({ slots }: { slots: { label: string; startTime: string; activeStudents: number; maxCapacity: number; pct: number }[] }) {
  const top = slots.slice(0, 5);
  return (
    <Card title="Ocupación por turno" right="Top 5">
      <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
        {top.length === 0 && (
          <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>Sin turnos activos</div>
        )}
        {top.map((s) => {
          const color =
            s.pct >= 90 ? "var(--overdue-coral)" :
            s.pct >= 70 ? "var(--pending-amber)" :
            "var(--paid-green)";
          return (
            <div key={s.label}>
              <div style={{ display: "flex", justifyContent: "space-between", fontSize: 12, marginBottom: 4 }}>
                <span style={{ fontWeight: 600, color: "var(--text-primary)" }}>{s.label}</span>
                <span style={{ fontWeight: 700, color }}>{s.activeStudents}/{s.maxCapacity} · {s.pct}%</span>
              </div>
              <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ width: `${Math.min(100, s.pct)}%`, height: "100%", background: color, borderRadius: 99, transition: "width 0.3s" }} />
              </div>
            </div>
          );
        })}
      </div>
    </Card>
  );
}

/* ───────────── Sales card ───────────── */
function SalesCard({ sales }: { sales: { total: number; count: number } }) {
  return (
    <Card title="Ventas de productos (30 días)">
      <div style={{ display: "flex", alignItems: "baseline", gap: 12 }}>
        <div style={{ fontSize: 26, fontWeight: 800, color: "var(--pool-deep)" }}>{formatCurrency(sales.total)}</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)" }}>{sales.count} venta{sales.count === 1 ? "" : "s"}</div>
      </div>
    </Card>
  );
}

/* ───────────── Card primitive ───────────── */
function Card({ title, right, children }: { title: string; right?: string; children: React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", borderRadius: 20, padding: 16, boxShadow: "var(--shadow-card)" }}>
      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 10 }}>
        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{title}</div>
        {right && <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)" }}>{right}</div>}
      </div>
      {children}
    </div>
  );
}

"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getGreeting, todayStr, formatCurrency } from "@/lib/utils";
import { useEffect, useState } from "react";
import Link from "next/link";

export default function HomePage() {
  const stats = useQuery(api.payments.getDashboardStats);
  const analytics = useQuery(api.payments.getAnalytics);
  const todaySlots = useQuery(api.attendance.getTodaySummary, { date: todayStr() });
  const seedConfig = useMutation(api.appConfig.seedDefaults);
  const seedSlots = useMutation(api.timeSlots.seedDefaultSlots);

  const [aiTip, setAiTip] = useState<string | null>(null);

  useEffect(() => {
    seedConfig();
    seedSlots();
  }, []);

  useEffect(() => {
    if (!analytics || !stats) return;

    const todayStr = new Date().toDateString();
    const cachedDate = localStorage.getItem("mistica_ai_suggestion_date");
    const cachedTip = localStorage.getItem("mistica_ai_suggestion");

    // Compute a highly relevant fallback suggestion locally based on real statistics
    const activeCount = analytics.activeCount;
    const overdueCount = stats.overdueCount ?? 0;
    const expiringSoon = stats.expiringSoon ?? 0;
    const collectionRate = analytics.collectionRate;

    const localSuggestion = overdueCount > 0
      ? `Tienes ${overdueCount} alumno${overdueCount === 1 ? "" : "s"} en mora. Sugerimos enviar recordatorios de pago desde la sección de Cobros.`
      : expiringSoon > 0
      ? `Tienes ${expiringSoon} cobro${expiringSoon === 1 ? "" : "s"} próximo${expiringSoon === 1 ? "" : "s"} a vencer. Mantente atento.`
      : collectionRate < 70
      ? `La tasa de cobranza actual es del ${collectionRate}%. Sugerimos revisar los saldos pendientes de cobro.`
      : `¡Todo al día! Tienes ${activeCount} alumnos activos. Sigue registrando asistencias y ventas del día.`;

    // 1. If we have a cached daily suggestion, use it!
    if (cachedDate === todayStr && cachedTip) {
      setAiTip(cachedTip);
      return;
    }

    // 2. Set the local suggestion immediately so the banner is visible
    setAiTip(localSuggestion);

    // 3. Perform the background API request to get an AI-generated suggestion
    const fetchSuggestion = async () => {
      try {
        const collectedThisMonth = analytics.totalCollected;
        const expectedThisMonth = analytics.totalExpected;

        const response = await fetch("/api/ai-suggestion", {
          method: "POST",
          headers: {
            "Content-Type": "application/json"
          },
          body: JSON.stringify({
            activeCount,
            overdueCount,
            expiringSoon,
            collectedThisMonth,
            expectedThisMonth,
            collectionRate
          })
        });

        if (response.ok) {
          const json = await response.json();
          const suggestion = json.suggestion;
          if (suggestion) {
            const cleaned = suggestion.replace(/^["']|["']$/g, "");
            localStorage.setItem("mistica_ai_suggestion", cleaned);
            localStorage.setItem("mistica_ai_suggestion_date", todayStr);
            setAiTip(cleaned);
          }
        }
      } catch (err) {
        console.error("Error fetching AI suggestion:", err);
      }
    };

    fetchSuggestion();
  }, [analytics, stats]);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px", background: "var(--white)", borderBottom: "1px solid var(--border)", display: "flex", justifyContent: "space-between", alignItems: "center" }}>
        <div>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
            {getGreeting()} 👋
          </div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2, textTransform: "capitalize" }}>{dateLabel}</div>
        </div>
        {stats && stats.overdueCount > 0 && (
          <Link href="/cobros?filter=overdue" style={{ textDecoration: "none" }}>
            <div style={{ display: "flex", alignItems: "center", gap: 6, background: "var(--overdue-light)", border: "1px solid #FECACA", borderRadius: 99, padding: "6px 12px", whiteSpace: "nowrap" }}>
              <span style={{ fontSize: 14 }}>⚠️</span>
              <span style={{ fontSize: 13, fontWeight: 700, color: "var(--overdue-coral)" }}>{stats.overdueCount} en mora</span>
            </div>
          </Link>
        )}
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Alert chips */}
        {(stats?.expiringSoon ?? 0) > 0 && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            <Link href="/cobros?filter=pending" style={{ textDecoration: "none" }}>
              <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pending-light)", border: "1px solid #FDE68A", borderRadius: 99, padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0 }}>
                <span style={{ fontSize: 14 }}>🕐</span>
                <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pending-amber)" }}>{stats?.expiringSoon} próximos a vencer</span>
              </div>
            </Link>
          </div>
        )}

        {/* Metrics (Dashboard cards) */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          {[
            { label: "Alumnos activos", value: analytics ? analytics.activeCount : "—", accent: "var(--pool-blue)", bg: "var(--pool-light)", href: "/alumnos" },
            { label: "Cobrado este mes", value: analytics ? formatCurrency(analytics.totalCollected) : "—", accent: "var(--paid-green)", bg: "var(--paid-light)", href: "/cobros" },
            { label: "En mora", value: analytics ? analytics.paymentsBreakdown.overdue : "—", accent: "var(--overdue-coral)", bg: "var(--overdue-light)", href: "/cobros?filter=overdue" },
            { label: "Ventas 30d", value: analytics ? formatCurrency(analytics.salesLast30Days.total) : "—", accent: "var(--pending-amber)", bg: "var(--pending-light)", href: "/ventas" },
          ].map((k) => {
            const cardContent = (
              <div style={{ background: "var(--white)", borderRadius: 20, padding: 14, boxShadow: "var(--shadow-card)", position: "relative", overflow: "hidden", height: "100%", minHeight: 82, display: "flex", flexDirection: "column", justifyContent: "center" }}>
                <div style={{ position: "absolute", inset: 0, background: `linear-gradient(135deg, ${k.bg} 0%, transparent 60%)`, opacity: 0.7 }} />
                <div style={{ position: "relative" }}>
                  <div style={{ fontSize: 11, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>{k.label}</div>
                  <div style={{ fontSize: 22, fontWeight: 800, color: k.accent, marginTop: 6, lineHeight: 1.1 }}>{k.value}</div>
                </div>
              </div>
            );
            return (
              <Link key={k.label} href={k.href} style={{ textDecoration: "none" }}>
                {cardContent}
              </Link>
            );
          })}
        </div>

        {/* Tasa de cobranza (mes actual) */}
        {analytics && (
          <CollectionRateCard
            rate={analytics.collectionRate}
            collected={analytics.totalCollected}
            expected={analytics.totalExpected}
          />
        )}

        {/* Quick actions */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Acciones rápidas</div>

          {/* AI Suggestion Banner */}
          {aiTip && (
            <div style={{
              background: "linear-gradient(135deg, #F0FDFA 0%, #CCFBF1 100%)",
              border: "1px solid #99F6E4",
              borderRadius: 16,
              padding: "12px 14px",
              marginBottom: 12,
              display: "flex",
              alignItems: "center",
              gap: 10,
              boxShadow: "var(--shadow-card)"
            }}>
              <span style={{ fontSize: 18 }}>💡</span>
              <div style={{ display: "flex", flexDirection: "column", gap: 1 }}>
                <span style={{ fontSize: 10, fontWeight: 700, color: "#0F766E", textTransform: "uppercase", letterSpacing: "0.05em" }}>Sugerencia IA</span>
                <span style={{ fontSize: 12, color: "#115E59", fontWeight: 600, lineHeight: 1.3 }}>{aiTip}</span>
              </div>
            </div>
          )}

          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { href: "/alumnos/nuevo", icon: "➕", label: "Nuevo alumno", color: "var(--pool-blue)" },
              { href: "/dashboard", icon: "📊", label: "Dashboard", color: "var(--pool-deep)" },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--white)", borderRadius: 14, padding: "10px 14px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 10 }}>
                  <span style={{ fontSize: 18 }}>{a.icon}</span>
                  <span style={{ fontSize: 12, fontWeight: 700, color: "var(--text-primary)" }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>

        {/* Today's schedule */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Horario de hoy</div>
          {!todaySlots || todaySlots.length === 0 ? (
            <div style={{ background: "var(--white)", borderRadius: 20, padding: "24px", textAlign: "center", boxShadow: "var(--shadow-card)" }}>
              <div style={{ fontSize: 32, marginBottom: 8 }}>🏊</div>
              <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>No hay clases programadas hoy</div>
            </div>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 10 }}>
              {todaySlots.map(slot => (
                <Link key={slot._id} href={`/asistencia?slotId=${slot._id}&date=${todayStr()}`} style={{ textDecoration: "none" }}>
                  <div style={{ background: "var(--white)", borderRadius: 16, padding: "14px 16px", boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                    <div>
                      <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>{slot.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{slot.startTime} – {slot.endTime}</div>
                    </div>
                    <div style={{ textAlign: "right" }}>
                      <div style={{ fontSize: 20, fontWeight: 800, color: slot.recorded ? "var(--paid-green)" : "var(--pool-blue)" }}>
                        {slot.recorded ? "✓" : `${slot.activeStudents}`}
                      </div>
                      <div style={{ fontSize: 11, color: "var(--text-secondary)" }}>
                        {slot.recorded ? "Tomada" : `/ ${slot.maxCapacity}`}
                      </div>
                    </div>
                  </div>
                </Link>
              ))}
            </div>
          )}
        </div>

      </div>
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

function Row({ label, value, color }: { label: string; value: string; color: string }) {
  return (
    <div style={{ display: "flex", justifyContent: "space-between", padding: "3px 0", fontSize: 13 }}>
      <span style={{ color: "var(--text-secondary)" }}>{label}</span>
      <span style={{ fontWeight: 700, color }}>{value}</span>
    </div>
  );
}

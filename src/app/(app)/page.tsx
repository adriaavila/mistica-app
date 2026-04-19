"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../convex/_generated/api";
import { getGreeting, todayStr, formatCurrency } from "@/lib/utils";
import { useEffect } from "react";
import Link from "next/link";

export default function HomePage() {
  const stats = useQuery(api.payments.getDashboardStats);
  const todaySlots = useQuery(api.attendance.getTodaySummary, { date: todayStr() });
  const seedConfig = useMutation(api.appConfig.seedDefaults);
  const seedSlots = useMutation(api.timeSlots.seedDefaultSlots);

  useEffect(() => {
    seedConfig();
    seedSlots();
  }, []);

  const today = new Date();
  const dateLabel = today.toLocaleDateString("es-VE", { weekday: "long", day: "numeric", month: "long" });

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{ padding: "24px 20px 16px", background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>
          {getGreeting()} 👋
        </div>
        <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 2, textTransform: "capitalize" }}>{dateLabel}</div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* Alert chips */}
        {((stats?.overdueCount ?? 0) > 0 || (stats?.expiringSoon ?? 0) > 0) && (
          <div style={{ display: "flex", gap: 10, overflowX: "auto", paddingBottom: 4, scrollbarWidth: "none" }}>
            {(stats?.overdueCount ?? 0) > 0 && (
              <Link href="/cobros?filter=overdue" style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--overdue-light)", border: "1px solid #FECACA", borderRadius: 99, padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>⚠️</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--overdue-coral)" }}>{stats!.overdueCount} en mora</span>
                </div>
              </Link>
            )}
            {(stats?.expiringSoon ?? 0) > 0 && (
              <Link href="/cobros?filter=pending" style={{ textDecoration: "none" }}>
                <div style={{ display: "flex", alignItems: "center", gap: 8, background: "var(--pending-light)", border: "1px solid #FDE68A", borderRadius: 99, padding: "8px 14px", whiteSpace: "nowrap", flexShrink: 0 }}>
                  <span style={{ fontSize: 14 }}>🕐</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--pending-amber)" }}>{stats!.expiringSoon} próximos a vencer</span>
                </div>
              </Link>
            )}
          </div>
        )}

        {/* Metrics */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12 }}>
          <div style={{ background: "var(--white)", borderRadius: 20, padding: "16px", boxShadow: "var(--shadow-card)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Alumnos activos</div>
            <div style={{ fontSize: 32, fontWeight: 800, color: "var(--pool-blue)", marginTop: 6, lineHeight: 1 }}>{stats?.activeStudents ?? "—"}</div>
          </div>
          <div style={{ background: "var(--white)", borderRadius: 20, padding: "16px", boxShadow: "var(--shadow-card)" }}>
            <div style={{ fontSize: 12, fontWeight: 600, color: "var(--text-secondary)", textTransform: "uppercase", letterSpacing: "0.05em" }}>Cobrado este mes</div>
            <div style={{ fontSize: 24, fontWeight: 800, color: "var(--paid-green)", marginTop: 6, lineHeight: 1 }}>{stats ? formatCurrency(stats.collectedThisMonth) : "—"}</div>
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

        {/* Quick actions */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Acciones rápidas</div>
          <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 10 }}>
            {[
              { href: "/alumnos/nuevo", icon: "➕", label: "Nuevo alumno", color: "var(--pool-blue)" },
              { href: "/cobros", icon: "📋", label: "Ver cobros", color: "var(--pending-amber)" },
              { href: "/asistencia", icon: "📅", label: "Asistencia", color: "var(--paid-green)" },
              { href: "/dashboard", icon: "📊", label: "Dashboard", color: "var(--pool-deep)" },
            ].map(a => (
              <Link key={a.href} href={a.href} style={{ textDecoration: "none" }}>
                <div style={{ background: "var(--white)", borderRadius: 16, padding: "16px", boxShadow: "var(--shadow-card)", display: "flex", flexDirection: "column", gap: 8 }}>
                  <span style={{ fontSize: 24 }}>{a.icon}</span>
                  <span style={{ fontSize: 13, fontWeight: 600, color: "var(--text-primary)" }}>{a.label}</span>
                </div>
              </Link>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}

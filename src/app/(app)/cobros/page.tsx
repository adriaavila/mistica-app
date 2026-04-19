"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSearchParams } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, getRelativeDays, formatMonth } from "@/lib/utils";
import { Id } from "../../../../convex/_generated/dataModel";
import { Suspense } from "react";

function buildWhatsAppUrl(phone: string, message: string) {
  let num = phone.replace(/\D/g, "");
  if (num.startsWith("0")) num = "58" + num.slice(1);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function getLast6Months() {
  const months = [];
  const now = new Date();
  for (let i = 0; i < 6; i++) {
    const d = new Date(now.getFullYear(), now.getMonth() - i, 1);
    months.push(`${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, "0")}`);
  }
  return months;
}

type PaidPayment = {
  _id: Id<"payments">;
  amount: number;
  type: string;
  month?: string;
  student?: { name: string; phone: string } | null;
};

function WhatsAppModal({ payment, onClose, currency }: {
  payment: PaidPayment;
  onClose: () => void;
  currency: string;
}) {
  const name = payment.student?.name ?? "alumno/a";
  const phone = payment.student?.phone ?? "";
  const concepto = payment.type === "enrollment"
    ? "Inscripción"
    : `Mensualidad${payment.month ? " " + formatMonth(payment.month) : ""}`;
  const monto = formatCurrency(payment.amount, currency);
  const message = `Hola ${name} 👋, confirmamos tu pago de *${monto}* por *${concepto}*. ¡Gracias! 🏊 — Mística`;
  const url = phone ? buildWhatsAppUrl(phone, message) : null;

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px calc(24px + env(safe-area-inset-bottom))",
          fontFamily: "var(--font)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ textAlign: "center", marginBottom: 20 }}>
          <div style={{ fontSize: 40, marginBottom: 8 }}>✅</div>
          <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>Pago registrado</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 4 }}>
            {name} · {concepto} · {monto}
          </div>
        </div>
        <div style={{
          background: "var(--surface-2)", borderRadius: 14, padding: 14,
          fontSize: 13, color: "var(--text-secondary)", marginBottom: 16, lineHeight: 1.6,
        }}>
          {message}
        </div>
        {url ? (
          <a
            href={url} target="_blank" rel="noopener noreferrer"
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, width: "100%", padding: "14px",
              background: "#25D366", color: "#fff", borderRadius: 12,
              fontWeight: 700, fontSize: 15, textDecoration: "none",
              boxSizing: "border-box", fontFamily: "var(--font)",
            }}
          >
            <span style={{ fontSize: 20 }}>📲</span> Enviar por WhatsApp
          </a>
        ) : (
          <div style={{ fontSize: 13, color: "var(--text-secondary)", textAlign: "center" }}>
            Sin teléfono registrado para este alumno
          </div>
        )}
        <button
          onClick={onClose}
          style={{
            width: "100%", marginTop: 10, padding: "12px",
            background: "none", border: "none",
            color: "var(--text-secondary)", fontSize: 14,
            fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
          }}
        >Cerrar</button>
      </div>
    </div>
  );
}

function GenerarModal({ onClose }: { onClose: () => void }) {
  const generateMonthly = useMutation(api.payments.generateMonthly);
  const now = new Date();
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);
  const [result, setResult] = useState<{ created: number } | null>(null);

  const run = async () => {
    setLoading(true);
    const res = await generateMonthly({ month });
    setResult(res);
    setLoading(false);
  };

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px calc(24px + env(safe-area-inset-bottom))",
          fontFamily: "var(--font)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {result ? (
          <div style={{ textAlign: "center" }}>
            <div style={{ fontSize: 44, marginBottom: 12 }}>🎉</div>
            <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>
              {result.created} mensualidades creadas
            </div>
            <div style={{ fontSize: 14, color: "var(--text-secondary)", marginTop: 6 }}>
              Para {formatMonth(month)}. Alumnos ya con pago existente fueron omitidos.
            </div>
            <button
              onClick={onClose}
              style={{
                marginTop: 20, width: "100%", padding: "14px",
                background: "var(--pool-blue)", color: "#fff",
                border: "none", borderRadius: 12,
                fontSize: 15, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)",
              }}
            >Listo</button>
          </div>
        ) : (
          <>
            <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Generar mensualidades</div>
            <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 20 }}>
              Crea pagos pendientes para todos los alumnos activos según sus precios de modalidad.
            </div>
            <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 }}>Mes</label>
            <input
              type="month" value={month} onChange={(e) => setMonth(e.target.value)}
              style={{
                width: "100%", padding: "12px 14px", borderRadius: 12,
                border: "1.5px solid var(--border)", fontSize: 15,
                fontFamily: "var(--font)", marginBottom: 16,
                boxSizing: "border-box", background: "var(--surface)",
              }}
            />
            <button
              onClick={run} disabled={loading}
              style={{
                width: "100%", padding: "14px",
                background: loading ? "var(--surface-2)" : "var(--pool-blue)",
                color: loading ? "var(--text-secondary)" : "#fff",
                border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
                cursor: loading ? "default" : "pointer", fontFamily: "var(--font)",
              }}
            >{loading ? "Generando…" : "Generar"}</button>
          </>
        )}
      </div>
    </div>
  );
}

function RecordatoriosModal({ onClose, currency }: { onClose: () => void; currency: string }) {
  const overduePayments = useQuery(api.payments.listOverdue);
  const [sent, setSent] = useState<Set<string>>(new Set());

  return (
    <div style={{
      position: "fixed", inset: 0, zIndex: 100,
      background: "rgba(0,0,0,0.5)", display: "flex",
      alignItems: "flex-end", justifyContent: "center",
    }} onClick={onClose}>
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "20px 20px 0 0", maxHeight: "80dvh",
          display: "flex", flexDirection: "column", fontFamily: "var(--font)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ padding: "20px 20px 0" }}>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 4 }}>
            <div style={{ fontSize: 18, fontWeight: 800 }}>Recordatorios en mora</div>
            <button onClick={onClose} style={{ background: "none", border: "none", fontSize: 20, cursor: "pointer", color: "var(--text-secondary)" }}>✕</button>
          </div>
          <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 14 }}>
            {sent.size}/{overduePayments?.length ?? "…"} enviados
          </div>
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 24px" }}>
          {!overduePayments ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Cargando…</div>
          ) : overduePayments.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center" }}>🎉 Sin morosos</div>
          ) : (
            overduePayments.map(p => {
              const name = p.student?.name ?? "—";
              const phone = p.student?.phone ?? "";
              const rel = getRelativeDays(p.dueDate);
              const concepto = p.type === "enrollment" ? "Inscripción" : `Mensualidad${p.month ? " " + formatMonth(p.month) : ""}`;
              const monto = formatCurrency(p.amount, currency);
              const message = `Hola ${name} 👋, tienes un pago pendiente de *${monto}* (${concepto}) vencido hace ${Math.abs(rel.days)} días. Por favor regulariza tu situación. 🙏 — Mística`;
              const url = phone ? buildWhatsAppUrl(phone, message) : null;
              const wasSent = sent.has(p._id);

              return (
                <div key={p._id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0", borderBottom: "1px solid var(--border)",
                }}>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--overdue-coral)", fontWeight: 600 }}>{rel.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{monto} · {concepto}</div>
                  </div>
                  {url ? (
                    <a
                      href={url} target="_blank" rel="noopener noreferrer"
                      onClick={() => setSent(prev => new Set([...prev, p._id]))}
                      style={{
                        display: "flex", alignItems: "center", gap: 5,
                        padding: "8px 12px", borderRadius: 10, flexShrink: 0,
                        background: wasSent ? "var(--surface-2)" : "#25D366",
                        color: wasSent ? "var(--text-secondary)" : "#fff",
                        fontSize: 12, fontWeight: 700, textDecoration: "none",
                        fontFamily: "var(--font)",
                      }}
                    >{wasSent ? "✓ Enviado" : "📲 WS"}</a>
                  ) : (
                    <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>Sin tel.</span>
                  )}
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
  );
}

function CobrosContent() {
  const searchParams = useSearchParams();
  const [filter, setFilter] = useState(searchParams.get("filter") ?? "all");
  const [monthFilter, setMonthFilter] = useState("all");
  const [whatsappPayment, setWhatsappPayment] = useState<PaidPayment | null>(null);
  const [showGenerar, setShowGenerar] = useState(false);
  const [showRecordatorios, setShowRecordatorios] = useState(false);

  const payments = useQuery(api.payments.listAll, {});
  const config = useQuery(api.appConfig.getAll);
  const currency = config?.currency ?? "Bs";
  const markPaid = useMutation(api.payments.markPaid);
  const markPending = useMutation(api.payments.markPending);

  const months6 = getLast6Months();

  const filtered = useMemo(() => {
    if (!payments) return [];
    const today = new Date().toISOString().split("T")[0];
    return payments
      .map(p => ({
        ...p,
        effectiveStatus: p.status !== "paid" && p.dueDate < today ? "overdue" as const : p.status,
      }))
      .filter(p => {
        if (filter === "overdue") return p.effectiveStatus === "overdue";
        if (filter === "pending") return p.effectiveStatus === "pending";
        if (filter === "paid") return p.effectiveStatus === "paid";
        return true;
      })
      .filter(p => monthFilter === "all" || p.dueDate.startsWith(monthFilter))
      .sort((a, b) => {
        const order = { overdue: 0, pending: 1, paid: 2 };
        const oa = order[a.effectiveStatus] ?? 1;
        const ob = order[b.effectiveStatus] ?? 1;
        if (oa !== ob) return oa - ob;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [payments, filter, monthFilter]);

  const overdueCount = payments?.filter(p =>
    p.status !== "paid" && p.dueDate < new Date().toISOString().split("T")[0]
  ).length ?? 0;

  const handleMarkPaid = async (payment: typeof filtered[0]) => {
    await markPaid({ id: payment._id as Id<"payments"> });
    setWhatsappPayment({
      _id: payment._id as Id<"payments">,
      amount: payment.amount,
      type: payment.type,
      month: payment.month,
      student: payment.student ? { name: payment.student.name, phone: (payment.student as { phone?: string }).phone ?? "" } : null,
    });
  };

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 0", background: "var(--white)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Cobros</div>
          <div style={{ display: "flex", gap: 8 }}>
            {overdueCount > 0 && (
              <button
                onClick={() => setShowRecordatorios(true)}
                style={{
                  background: "var(--overdue-light)", borderRadius: 99, padding: "5px 11px",
                  fontSize: 12, fontWeight: 700, color: "var(--overdue-coral)",
                  border: "none", cursor: "pointer", fontFamily: "var(--font)",
                }}
              >📲 Recordar {overdueCount}</button>
            )}
            <button
              onClick={() => setShowGenerar(true)}
              style={{
                background: "var(--pool-light)", borderRadius: 99, padding: "5px 11px",
                fontSize: 12, fontWeight: 700, color: "var(--pool-blue)",
                border: "none", cursor: "pointer", fontFamily: "var(--font)",
              }}
            >+ Generar</button>
          </div>
        </div>

        {/* Month filter chips */}
        <div style={{ display: "flex", gap: 8, overflowX: "auto", paddingBottom: 10, scrollbarWidth: "none" }}>
          {[
            { value: "all", label: "Todos" },
            ...months6.map(m => {
              const [y, mo] = m.split("-");
              const monthNames = ["Ene","Feb","Mar","Abr","May","Jun","Jul","Ago","Sep","Oct","Nov","Dic"];
              return { value: m, label: `${monthNames[parseInt(mo) - 1]} ${y}` };
            }),
          ].map(opt => (
            <button
              key={opt.value}
              onClick={() => setMonthFilter(opt.value)}
              style={{
                flexShrink: 0, padding: "5px 12px", borderRadius: 99,
                border: "1.5px solid",
                borderColor: monthFilter === opt.value ? "var(--pool-blue)" : "var(--border)",
                background: monthFilter === opt.value ? "var(--pool-light)" : "transparent",
                color: monthFilter === opt.value ? "var(--pool-blue)" : "var(--text-secondary)",
                fontSize: 12, fontWeight: 600, cursor: "pointer",
                fontFamily: "var(--font)", whiteSpace: "nowrap",
              }}
            >{opt.label}</button>
          ))}
        </div>

        <div style={{ paddingBottom: 12 }}>
          <SegmentedControl
            fullWidth
            options={[
              { value: "all", label: "Todos" },
              { value: "overdue", label: "En mora" },
              { value: "pending", label: "Pendientes" },
              { value: "paid", label: "Pagados" },
            ]}
            value={filter}
            onChange={setFilter}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!payments ? (
          Array.from({ length: 6 }).map((_, i) => (
            <div key={i} style={{ height: 80, borderRadius: 16, background: "var(--surface-2)" }} />
          ))
        ) : filtered.length === 0 ? (
          <EmptyState emoji="📋" title="Sin cobros" description="No hay cobros en esta categoría" />
        ) : (
          filtered.map(payment => {
            const rel = getRelativeDays(payment.dueDate);
            const isOverdue = payment.effectiveStatus === "overdue";
            const isPaid = payment.effectiveStatus === "paid";
            return (
              <div
                key={payment._id}
                style={{
                  background: "var(--white)", borderRadius: 16, padding: "14px 16px",
                  boxShadow: "var(--shadow-card)",
                  borderLeft: isOverdue ? "3px solid var(--overdue-coral)" : undefined,
                  display: "flex", alignItems: "center", gap: 12,
                }}
              >
                {payment.student && <Avatar name={payment.student.name} size={40} />}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
                    {payment.student?.name ?? "—"}
                  </div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                    {payment.type === "enrollment" ? "Inscripción" : `Mensualidad${payment.month ? " " + payment.month : ""}`}
                  </div>
                  <div style={{
                    fontSize: 12, marginTop: 3, fontWeight: 600,
                    color: isPaid ? "var(--paid-green)" : isOverdue ? "var(--overdue-coral)" : rel.urgency === "soon" ? "var(--pending-amber)" : "var(--text-secondary)",
                  }}>
                    {isPaid ? `Pagado ${payment.paidAt ? formatDate(payment.paidAt) : ""}` : rel.label}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                    {formatCurrency(payment.amount, currency)}
                  </span>
                  {!isPaid ? (
                    <button
                      onClick={() => handleMarkPaid(payment)}
                      style={{
                        background: "var(--paid-green)", color: "#fff", border: "none",
                        borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                        cursor: "pointer", fontFamily: "var(--font)",
                      }}
                    >✓ Pago</button>
                  ) : (
                    <button
                      onClick={() => markPending({ id: payment._id as Id<"payments"> })}
                      style={{
                        background: "var(--surface-2)", color: "var(--text-secondary)", border: "none",
                        borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600,
                        cursor: "pointer", fontFamily: "var(--font)",
                      }}
                    >↩ Revertir</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>

      {whatsappPayment && (
        <WhatsAppModal
          payment={whatsappPayment}
          currency={currency}
          onClose={() => setWhatsappPayment(null)}
        />
      )}
      {showGenerar && <GenerarModal onClose={() => setShowGenerar(false)} />}
      {showRecordatorios && (
        <RecordatoriosModal currency={currency} onClose={() => setShowRecordatorios(false)} />
      )}
    </div>
  );
}

export default function CobrosPage() {
  return <Suspense><CobrosContent /></Suspense>;
}

"use client";
import { useState, useMemo, useEffect } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import ConfirmSheet from "@/components/ui/ConfirmSheet";
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

type PaySheetTarget = {
  id: Id<"payments">;
  amount: number;
  paidAmount: number;
  studentName: string;
};

type ConfirmAction = {
  title: string;
  description: string;
  confirmLabel: string;
  danger?: boolean;
  run: () => Promise<void>;
};

function PaySheet({
  target,
  currency,
  onClose,
  onDone,
}: {
  target: PaySheetTarget;
  currency: string;
  onClose: () => void;
  onDone: (method: "qr" | "cash") => void;
}) {
  const markPaidMut = useMutation(api.payments.markPaid);
  const addPartial = useMutation(api.payments.addPartialPayment);
  const remaining = target.amount - target.paidAmount;
  const [method, setMethod] = useState<"qr" | "cash">("cash");
  const [isPartial, setIsPartial] = useState(false);
  const [partialAmt, setPartialAmt] = useState(String(remaining));
  const [paidAt, setPaidAt] = useState(new Date().toISOString().split("T")[0]);
  const [loading, setLoading] = useState(false);

  const labelStyle: React.CSSProperties = { fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 6 };
  const inputStyle: React.CSSProperties = { width: "100%", padding: "12px 14px", borderRadius: 12, border: "1.5px solid var(--border)", fontSize: 15, fontFamily: "var(--font)", marginBottom: 16, boxSizing: "border-box", background: "var(--surface)" };

  const handleConfirm = async () => {
    setLoading(true);
    if (isPartial) {
      const amt = parseFloat(partialAmt);
      if (!amt || amt <= 0) { setLoading(false); return; }
      await addPartial({ id: target.id, amount: amt, paymentMethod: method, paidAt });
      onClose();
    } else {
      await markPaidMut({ id: target.id, paymentMethod: method, paidAt });
      onDone(method);
    }
    setLoading(false);
  };

  return (
    <div
      style={{ position: "fixed", inset: 0, zIndex: 100, background: "rgba(0,0,0,0.5)", display: "flex", alignItems: "flex-end", justifyContent: "center" }}
      onClick={onClose}
    >
      <div
        style={{ width: "100%", maxWidth: 480, background: "#fff", borderRadius: "20px 20px 0 0", padding: "24px 20px calc(28px + env(safe-area-inset-bottom))", fontFamily: "var(--font)" }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 4 }}>Registrar pago</div>
        <div style={{ fontSize: 13, color: "var(--text-secondary)", marginBottom: 16 }}>{target.studentName} · {formatCurrency(target.amount, currency)}</div>

        {target.paidAmount > 0 && (
          <div style={{ background: "var(--surface-2)", borderRadius: 10, padding: "10px 14px", marginBottom: 16, fontSize: 13, color: "var(--text-secondary)" }}>
            Abonado: <strong>{formatCurrency(target.paidAmount, currency)}</strong> · Resta: <strong>{formatCurrency(remaining, currency)}</strong>
          </div>
        )}

        <label style={labelStyle}>Método de pago</label>
        <div style={{ display: "flex", gap: 8, marginBottom: 16 }}>
          {(["cash", "qr"] as const).map((m) => (
            <button
              key={m}
              onClick={() => setMethod(m)}
              style={{
                flex: 1, padding: "10px", borderRadius: 10, border: "2px solid",
                borderColor: method === m ? "var(--pool-blue)" : "var(--border)",
                background: method === m ? "var(--pool-light)" : "transparent",
                color: method === m ? "var(--pool-blue)" : "var(--text-secondary)",
                fontWeight: 700, fontSize: 14, cursor: "pointer", fontFamily: "var(--font)",
              }}
            >{m === "cash" ? "💵 Efectivo" : "📱 QR"}</button>
          ))}
        </div>

        <label style={labelStyle}>Fecha de cobro</label>
        <input type="date" value={paidAt} onChange={(e) => setPaidAt(e.target.value)} style={inputStyle} />

        <label style={{ ...labelStyle, display: "flex", alignItems: "center", gap: 8, marginBottom: 16, cursor: "pointer" }}>
          <input type="checkbox" checked={isPartial} onChange={(e) => setIsPartial(e.target.checked)} style={{ width: 16, height: 16 }} />
          Pago parcial
        </label>

        {isPartial && (
          <>
            <label style={labelStyle}>Monto a abonar ({currency})</label>
            <input type="number" value={partialAmt} onChange={(e) => setPartialAmt(e.target.value)} style={inputStyle} />
          </>
        )}

        <button
          onClick={handleConfirm} disabled={loading}
          style={{
            width: "100%", padding: "14px",
            background: loading ? "var(--surface-2)" : "var(--pool-blue)",
            color: loading ? "var(--text-secondary)" : "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading ? "default" : "pointer", fontFamily: "var(--font)",
          }}
        >{loading ? "Guardando…" : isPartial ? "Registrar abono" : "Confirmar pago"}</button>
      </div>
    </div>
  );
}

function WhatsAppModal({ payment, onClose, currency, wahaConnected }: {
  payment: PaidPayment;
  onClose: () => void;
  currency: string;
  wahaConnected: boolean;
}) {
  const name = payment.student?.name ?? "alumno/a";
  const phone = payment.student?.phone ?? "";
  const concepto = payment.type === "enrollment"
    ? "Inscripción"
    : `Mensualidad${payment.month ? " " + formatMonth(payment.month) : ""}`;
  const monto = formatCurrency(payment.amount, currency);
  const message = `Hola ${name} 👋, confirmamos tu pago de *${monto}* por *${concepto}*. ¡Gracias! 🏊 — Mística`;
  const url = phone ? buildWhatsAppUrl(phone, message) : null;

  const [sending, setSending] = useState(false);
  const [sent, setSent] = useState(false);

  const handleSendReceipt = async () => {
    if (wahaConnected && phone) {
      setSending(true);
      try {
        const res = await fetch("/api/payments/remind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSent(true);
          return;
        }
        throw new Error(data.error || "Failed to send");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("WAHA receipt send failed, falling back to manual:", errMsg);
        alert(`No se pudo enviar automáticamente (${errMsg}). Abriendo WhatsApp Web...`);
        if (url) window.open(url, "_blank");
        setSent(true);
      } finally {
        setSending(false);
      }
    } else {
      if (url) {
        window.open(url, "_blank");
        setSent(true);
      }
    }
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
          <button
            onClick={handleSendReceipt}
            disabled={sending}
            style={{
              display: "flex", alignItems: "center", justifyContent: "center",
              gap: 8, width: "100%", padding: "14px",
              background: sent || sending ? "var(--surface-2)" : "#25D366",
              color: sent || sending ? "var(--text-secondary)" : "#fff",
              borderRadius: 12, border: "none", cursor: sending ? "default" : "pointer",
              fontWeight: 700, fontSize: 15, textDecoration: "none",
              boxSizing: "border-box", fontFamily: "var(--font)",
            }}
          >
            <span style={{ fontSize: 20 }}>{sending ? "⌛" : sent ? "✓" : "📲"}</span>{" "}
            {sending ? "Enviando..." : sent ? "Enviado" : wahaConnected ? "Enviar por WhatsApp" : "Enviar (Abrir WhatsApp Web)"}
          </button>
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

function RecordatoriosModal({ onClose, currency, wahaConnected }: { onClose: () => void; currency: string; wahaConnected: boolean }) {
  const overduePayments = useQuery(api.payments.listOverdue);
  const removePayment = useMutation(api.payments.remove);
  const [sendingIds, setSendingIds] = useState<Set<string>>(new Set());
  const [sentIds, setSentIds] = useState<Set<string>>(new Set());
  const [selectedIds, setSelectedIds] = useState<Set<string>>(new Set());
  const [batchRunning, setBatchRunning] = useState(false);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);

  const toggleSelected = (paymentId: string) => {
    setSelectedIds(prev => {
      const next = new Set(prev);
      if (next.has(paymentId)) next.delete(paymentId);
      else next.add(paymentId);
      return next;
    });
  };

  // Build the send args (message + wa.me fallback url) for one overdue payment.
  const buildSendArgs = (p: NonNullable<typeof overduePayments>[number]) => {
    const name = p.student?.name ?? "—";
    const phone = p.student?.phone ?? "";
    const rel = getRelativeDays(p.dueDate);
    const concepto = p.type === "enrollment" ? "Inscripción" : `Mensualidad${p.month ? " " + formatMonth(p.month) : ""}`;
    const monto = formatCurrency(p.amount, currency);
    const message = `Hola ${name} 👋, tienes un pago pendiente de *${monto}* (${concepto}) vencido hace ${Math.abs(rel.days)} días. Por favor regulariza tu situación. 🙏 — Mística`;
    const url = phone ? buildWhatsAppUrl(phone, message) : null;
    return { phone, message, url };
  };

  const handleSendReminder = async (paymentId: string, phone: string, message: string, fallbackUrl: string | null) => {
    if (wahaConnected && phone) {
      setSendingIds(prev => new Set([...prev, paymentId]));
      try {
        const res = await fetch("/api/payments/remind", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ phone, message })
        });
        const data = await res.json();
        if (res.ok && data.success) {
          setSentIds(prev => new Set([...prev, paymentId]));
          return;
        }
        throw new Error(data.error || "Failed to send");
      } catch (err) {
        const errMsg = err instanceof Error ? err.message : "Unknown error";
        console.error("WAHA direct send failed, falling back to manual:", errMsg);
        alert(`No se pudo enviar automáticamente (${errMsg}). Abriendo WhatsApp Web...`);
        if (fallbackUrl) window.open(fallbackUrl, "_blank");
        setSentIds(prev => new Set([...prev, paymentId]));
      } finally {
        setSendingIds(prev => {
          const next = new Set(prev);
          next.delete(paymentId);
          return next;
        });
      }
    } else {
      if (fallbackUrl) {
        window.open(fallbackUrl, "_blank");
        setSentIds(prev => new Set([...prev, paymentId]));
      }
    }
  };

  // Most overdue first; only rows with a phone are selectable/sendable.
  const sorted = overduePayments ? [...overduePayments].sort((a, b) => a.dueDate.localeCompare(b.dueDate)) : [];
  const sendable = sorted.filter(p => p.student?.phone);
  const allSelected = sendable.length > 0 && sendable.every(p => selectedIds.has(p._id));

  const toggleSelectAll = () => {
    setSelectedIds(allSelected ? new Set() : new Set(sendable.map(p => p._id)));
  };

  const handleSendBatch = async () => {
    // Selected with phone, else all with phone; skip already-sent.
    const targets = (selectedIds.size > 0 ? sendable.filter(p => selectedIds.has(p._id)) : sendable)
      .filter(p => !sentIds.has(p._id));
    if (targets.length === 0) return;
    setBatchRunning(true);
    try {
      for (const p of targets) {
        const { phone, message, url } = buildSendArgs(p);
        await handleSendReminder(p._id, phone, message, url);
        // ponytail: fixed 3s gap between sends; swap for /api/mkt/send-batch anti-ban
        // spacing if WAHA starts rate-limiting reminders.
        await new Promise(r => setTimeout(r, 3000));
      }
    } finally {
      setBatchRunning(false);
    }
  };

  return (
    <>
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
            {sentIds.size}/{overduePayments?.length ?? "…"} enviados
          </div>
          {sendable.length > 0 && (
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 14 }}>
              <button
                onClick={toggleSelectAll}
                disabled={batchRunning}
                style={{
                  padding: "8px 12px", borderRadius: 10, border: "1px solid var(--border)",
                  background: "#fff", fontSize: 12, fontWeight: 700, cursor: batchRunning ? "default" : "pointer",
                  color: "var(--text-secondary)", fontFamily: "var(--font)", flexShrink: 0,
                }}
              >
                {allSelected ? "Quitar todos" : "Seleccionar todos"}
              </button>
              <button
                onClick={handleSendBatch}
                disabled={batchRunning}
                style={{
                  flex: 1, padding: "8px 12px", borderRadius: 10, border: "none",
                  background: batchRunning ? "var(--surface-2)" : "#25D366",
                  color: batchRunning ? "var(--text-secondary)" : "#fff",
                  fontSize: 12, fontWeight: 700, cursor: batchRunning ? "default" : "pointer",
                  fontFamily: "var(--font)",
                }}
              >
                {batchRunning
                  ? "⌛ Enviando..."
                  : `📲 Enviar a ${selectedIds.size > 0 ? `seleccionados (${selectedIds.size})` : `todos (${sendable.length})`}`}
              </button>
            </div>
          )}
        </div>
        <div style={{ overflowY: "auto", flex: 1, padding: "0 20px 24px" }}>
          {!overduePayments ? (
            <div style={{ padding: 20, textAlign: "center", color: "var(--text-secondary)" }}>Cargando…</div>
          ) : overduePayments.length === 0 ? (
            <div style={{ padding: 20, textAlign: "center" }}>🎉 Sin morosos</div>
          ) : (
            sorted.map(p => {
              const name = p.student?.name ?? "—";
              const phone = p.student?.phone ?? "";
              const rel = getRelativeDays(p.dueDate);
              const concepto = p.type === "enrollment" ? "Inscripción" : `Mensualidad${p.month ? " " + formatMonth(p.month) : ""}`;
              const monto = formatCurrency(p.amount, currency);
              const message = `Hola ${name} 👋, tienes un pago pendiente de *${monto}* (${concepto}) vencido hace ${Math.abs(rel.days)} días. Por favor regulariza tu situación. 🙏 — Mística`;
              const url = phone ? buildWhatsAppUrl(phone, message) : null;
              const wasSent = sentIds.has(p._id);
              const isSending = sendingIds.has(p._id);

              return (
                <div key={p._id} style={{
                  display: "flex", alignItems: "center", gap: 12,
                  padding: "12px 0", borderBottom: "1px solid var(--border)",
                }}>
                  {phone && (
                    <input
                      type="checkbox"
                      checked={selectedIds.has(p._id)}
                      onChange={() => toggleSelected(p._id)}
                      disabled={batchRunning}
                      style={{ width: 18, height: 18, flexShrink: 0, accentColor: "#25D366", cursor: "pointer" }}
                    />
                  )}
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ fontSize: 14, fontWeight: 700 }}>{name}</div>
                    <div style={{ fontSize: 12, color: "var(--overdue-coral)", fontWeight: 600 }}>{rel.label}</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>{monto} · {concepto}</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 6, flexShrink: 0 }}>
                    {phone ? (
                      <button
                        onClick={() => handleSendReminder(p._id, phone, message, url)}
                        disabled={isSending}
                        style={{
                          display: "flex", alignItems: "center", gap: 5,
                          padding: "8px 12px", borderRadius: 10,
                          border: "none", cursor: isSending ? "default" : "pointer",
                          background: wasSent ? "var(--surface-2)" : isSending ? "var(--surface-2)" : "#25D366",
                          color: wasSent || isSending ? "var(--text-secondary)" : "#fff",
                          fontSize: 12, fontWeight: 700,
                          fontFamily: "var(--font)",
                        }}
                      >
                        {isSending ? "⌛ Enviando..." : wasSent ? "✓ Enviado" : wahaConnected ? "📲 Enviar" : "📲 WS"}
                      </button>
                    ) : (
                      <span style={{ fontSize: 11, color: "var(--text-disabled)" }}>Sin tel.</span>
                    )}
                    <button
                      type="button"
                      aria-label={`Borrar cobro de ${name}`}
                      onClick={() => setConfirmAction({
                        title: "Borrar cobro",
                        description: `Se eliminará el cobro de ${monto} para ${name}. Esta acción no se puede deshacer.`,
                        confirmLabel: "Borrar cobro",
                        danger: true,
                        run: async () => {
                          await removePayment({ id: p._id as Id<"payments"> });
                        },
                      })}
                      style={{
                        background: "var(--overdue-light)", border: "none", borderRadius: 8,
                        padding: "8px 10px", fontSize: 13, cursor: "pointer",
                        color: "var(--overdue-coral)", fontFamily: "var(--font)",
                      }}
                      title="Eliminar cobro"
                    >🗑</button>
                  </div>
                </div>
              );
            })
          )}
        </div>
      </div>
    </div>
    {confirmAction && (
      <ConfirmSheet
        open
        title={confirmAction.title}
        description={confirmAction.description}
        confirmLabel={confirmAction.confirmLabel}
        danger={confirmAction.danger}
        onConfirm={confirmAction.run}
        onClose={() => setConfirmAction(null)}
      />
    )}
    </>
  );
}

function CobrosContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "all";
  const monthFilter = searchParams.get("month") ?? "all";
  const [whatsappPayment, setWhatsappPayment] = useState<PaidPayment | null>(null);
  const [showGenerar, setShowGenerar] = useState(false);
  const [showRecordatorios, setShowRecordatorios] = useState(false);
  const [paySheetTarget, setPaySheetTarget] = useState<PaySheetTarget | null>(null);
  const [confirmAction, setConfirmAction] = useState<ConfirmAction | null>(null);
  const [wahaConnected, setWahaConnected] = useState(false);

  const setUrlParam = (key: string, value: string, defaultValue = "all") => {
    const params = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  useEffect(() => {
    fetch("/api/mkt/whatsapp/status")
      .then((res) => res.json())
      .then((data) => {
        setWahaConnected(Boolean(data.online && data.status === "WORKING"));
      })
      .catch(() => setWahaConnected(false));
  }, []);

  const payments = useQuery(api.payments.listAll, {});
  const config = useQuery(api.appConfig.getAll);
  const currency = config?.currency ?? "Bs";
  const markPending = useMutation(api.payments.markPending);
  const removePayment = useMutation(api.payments.remove);

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
      .filter(p => {
        if (monthFilter === "all") return true;
        // Monthly payments filter by their billing month (permits shift dueDate
        // across month boundaries, so month is the stable key); others by dueDate.
        return p.month ? p.month === monthFilter : p.dueDate.startsWith(monthFilter);
      })
      .sort((a, b) => {
        const order = { overdue: 0, pending: 1, paid: 2 };
        const oa = order[a.effectiveStatus] ?? 1;
        const ob = order[b.effectiveStatus] ?? 1;
        if (oa !== ob) return oa - ob;
        if (a.effectiveStatus === "paid") {
          const dateA = a.paidAt || a.dueDate;
          const dateB = b.paidAt || b.dueDate;
          return dateB.localeCompare(dateA);
        }
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [payments, filter, monthFilter]);

  const overdueCount = payments?.filter(p =>
    p.status !== "paid" && p.dueDate < new Date().toISOString().split("T")[0]
  ).length ?? 0;

  const openPaySheet = (payment: typeof filtered[0]) => {
    setPaySheetTarget({
      id: payment._id as Id<"payments">,
      amount: payment.amount,
      paidAmount: (payment as { paidAmount?: number }).paidAmount ?? 0,
      studentName: payment.student?.name ?? "—",
    });
  };

  const handlePaidDone = (payment: typeof filtered[0]) => {
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
              onClick={() => setUrlParam("month", opt.value)}
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
            onChange={(value) => setUrlParam("filter", value)}
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
            const alreadyPaid = (payment as { paidAmount?: number }).paidAmount ?? 0;
            const isPartial = !isPaid && alreadyPaid > 0;
            const methodLabel = (payment as { paymentMethod?: string }).paymentMethod === "qr" ? " · QR" : (payment as { paymentMethod?: string }).paymentMethod === "cash" ? " · Efectivo" : "";
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
                    {payment.type === "enrollment" ? "Inscripción" : `Mensualidad${payment.month ? " " + formatMonth(payment.month) : ""}`}
                  </div>
                  <div style={{
                    fontSize: 12, marginTop: 3, fontWeight: 600,
                    color: isPaid ? "var(--paid-green)" : isOverdue ? "var(--overdue-coral)" : rel.urgency === "soon" ? "var(--pending-amber)" : "var(--text-secondary)",
                  }}>
                    {isPaid ? `Cobrado ${payment.paidAt ? formatDate(payment.paidAt) : "—"}${methodLabel} · Vence ${formatDate(payment.dueDate)}` : isPartial ? `Abonado ${formatCurrency(alreadyPaid, currency)} · ${rel.label}` : rel.label}
                  </div>
                  {isPartial && (
                    <div style={{ marginTop: 5, height: 4, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                      <div style={{ height: "100%", width: `${Math.min(100, (alreadyPaid / payment.amount) * 100)}%`, background: "var(--pending-amber)", borderRadius: 99 }} />
                    </div>
                  )}
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                    {formatCurrency(payment.amount, currency)}
                  </span>
                  {!isPaid ? (
                    <div style={{ display: "flex", gap: 6 }}>
                      <button
                        type="button"
                        onClick={() => setConfirmAction({
                          title: "Eximir cobro",
                          description: `Se eliminará el cobro de ${formatCurrency(payment.amount, currency)} para ${payment.student?.name ?? "este alumno"}. Úsalo solo si no se cobrará este monto.`,
                          confirmLabel: "Eximir cobro",
                          danger: true,
                          run: async () => {
                            await removePayment({ id: payment._id as Id<"payments"> });
                          },
                        })}
                        style={{
                          background: "var(--overdue-light)", color: "var(--overdue-coral)", border: "none",
                          borderRadius: 8, padding: "6px 8px", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: "var(--font)",
                        }}
                      >Eximir</button>
                      <button
                        onClick={() => openPaySheet(payment)}
                        style={{
                          background: "var(--paid-green)", color: "#fff", border: "none",
                          borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700,
                          cursor: "pointer", fontFamily: "var(--font)",
                        }}
                      >✓ Pago</button>
                    </div>
                  ) : (
                    <button
                      type="button"
                      onClick={() => setConfirmAction({
                        title: "Revertir pago",
                        description: `El cobro de ${formatCurrency(payment.amount, currency)} para ${payment.student?.name ?? "este alumno"} volverá a pendiente.`,
                        confirmLabel: "Revertir pago",
                        run: async () => {
                          await markPending({ id: payment._id as Id<"payments"> });
                        },
                      })}
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

      {paySheetTarget && (() => {
        const payment = filtered.find(p => p._id === paySheetTarget.id);
        return (
          <PaySheet
            target={paySheetTarget}
            currency={currency}
            onClose={() => setPaySheetTarget(null)}
            onDone={() => {
              if (payment) handlePaidDone(payment);
              setPaySheetTarget(null);
            }}
          />
        );
      })()}
      {whatsappPayment && (
        <WhatsAppModal
          payment={whatsappPayment}
          currency={currency}
          wahaConnected={wahaConnected}
          onClose={() => setWhatsappPayment(null)}
        />
      )}
      {showGenerar && <GenerarModal onClose={() => setShowGenerar(false)} />}
      {showRecordatorios && (
        <RecordatoriosModal currency={currency} wahaConnected={wahaConnected} onClose={() => setShowRecordatorios(false)} />
      )}
      {confirmAction && (
        <ConfirmSheet
          open
          title={confirmAction.title}
          description={confirmAction.description}
          confirmLabel={confirmAction.confirmLabel}
          danger={confirmAction.danger}
          onConfirm={confirmAction.run}
          onClose={() => setConfirmAction(null)}
        />
      )}
    </div>
  );
}

export default function CobrosPage() {
  return <Suspense><CobrosContent /></Suspense>;
}

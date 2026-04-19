"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { MODALITY_LABELS, formatDate, formatCurrency, getRelativeDays, formatMonth } from "@/lib/utils";
import Link from "next/link";
import { Id } from "../../../../../convex/_generated/dataModel";

function buildWhatsAppUrl(phone: string, message: string) {
  let num = phone.replace(/\D/g, "");
  if (num.startsWith("0")) num = "58" + num.slice(1);
  return `https://wa.me/${num}?text=${encodeURIComponent(message)}`;
}

function AddPaymentSheet({
  studentId,
  currency,
  onClose,
}: {
  studentId: Id<"students">;
  currency: string;
  onClose: () => void;
}) {
  const createPayment = useMutation(api.payments.create);
  const config = useQuery(api.appConfig.getAll);

  const now = new Date();
  const todayStr = now.toISOString().split("T")[0];
  const currentMonth = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;

  const [type, setType] = useState<"enrollment" | "monthly">("monthly");
  const [amount, setAmount] = useState("");
  const [dueDate, setDueDate] = useState(todayStr);
  const [month, setMonth] = useState(currentMonth);
  const [loading, setLoading] = useState(false);

  const priceMap: Record<string, string> = {
    enrollment: config?.price_enrollment ?? "",
    monthly: "",
  };

  const save = async () => {
    const amt = parseFloat(amount);
    if (!amt || amt <= 0) return;
    setLoading(true);
    await createPayment({
      studentId,
      type,
      amount: amt,
      dueDate,
      month: type === "monthly" ? month : undefined,
    });
    setLoading(false);
    onClose();
  };

  return (
    <div
      style={{
        position: "fixed", inset: 0, zIndex: 100,
        background: "rgba(0,0,0,0.5)", display: "flex",
        alignItems: "flex-end", justifyContent: "center",
      }}
      onClick={onClose}
    >
      <div
        style={{
          width: "100%", maxWidth: 480, background: "#fff",
          borderRadius: "20px 20px 0 0",
          padding: "24px 20px calc(28px + env(safe-area-inset-bottom))",
          fontFamily: "var(--font)",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 16 }}>Registrar pago</div>

        <label style={labelStyle}>Tipo</label>
        <div style={{ marginBottom: 16 }}>
          <SegmentedControl
            options={[
              { value: "monthly", label: "Mensualidad" },
              { value: "enrollment", label: "Inscripción" },
            ]}
            value={type}
            onChange={(v) => {
              setType(v as "enrollment" | "monthly");
              if (v === "enrollment" && priceMap.enrollment) setAmount(priceMap.enrollment);
            }}
          />
        </div>

        {type === "monthly" && (
          <>
            <label style={labelStyle}>Mes</label>
            <input
              type="month" value={month}
              onChange={(e) => setMonth(e.target.value)}
              style={inputStyle}
            />
          </>
        )}

        <label style={labelStyle}>Monto ({currency})</label>
        <input
          type="number" value={amount}
          onChange={(e) => setAmount(e.target.value)}
          placeholder="0"
          style={inputStyle}
        />

        <label style={labelStyle}>Fecha vencimiento</label>
        <input
          type="date" value={dueDate}
          onChange={(e) => setDueDate(e.target.value)}
          style={inputStyle}
        />

        <button
          onClick={save}
          disabled={loading || !amount || parseFloat(amount) <= 0}
          style={{
            width: "100%", padding: "14px",
            background: loading || !amount ? "var(--surface-2)" : "var(--pool-blue)",
            color: loading || !amount ? "var(--text-secondary)" : "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: loading || !amount ? "default" : "pointer", fontFamily: "var(--font)",
          }}
        >{loading ? "Guardando…" : "Registrar"}</button>
      </div>
    </div>
  );
}

function AttendanceTab({ studentId }: { studentId: Id<"students"> }) {
  const records = useQuery(api.attendance.listByStudent, { studentId });

  if (!records) {
    return (
      <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
        {Array.from({ length: 5 }).map((_, i) => (
          <div key={i} style={{ height: 48, borderRadius: 12, background: "var(--surface-2)" }} />
        ))}
      </div>
    );
  }

  if (records.length === 0) {
    return (
      <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-secondary)", fontSize: 14 }}>
        Sin registros de asistencia
      </div>
    );
  }

  // Group by month
  const byMonth: Record<string, typeof records> = {};
  for (const r of records) {
    const m = r.date.substring(0, 7);
    if (!byMonth[m]) byMonth[m] = [];
    byMonth[m].push(r);
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 16 }}>
      {Object.entries(byMonth)
        .sort(([a], [b]) => b.localeCompare(a))
        .map(([month, recs]) => {
          const present = recs.filter(r => r.present).length;
          const pct = recs.length > 0 ? Math.round((present / recs.length) * 100) : 0;
          return (
            <div key={month}>
              <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 8 }}>
                <div style={{ fontSize: 13, fontWeight: 700, color: "var(--text-secondary)" }}>
                  {formatMonth(month)}
                </div>
                <div style={{ fontSize: 12, fontWeight: 600, color: pct >= 70 ? "var(--paid-green)" : pct >= 50 ? "var(--pending-amber)" : "var(--overdue-coral)" }}>
                  {present}/{recs.length} · {pct}%
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {recs.map(r => (
                  <div
                    key={r._id}
                    style={{
                      display: "flex", alignItems: "center", gap: 12,
                      background: "var(--white)", borderRadius: 12,
                      padding: "10px 14px", boxShadow: "var(--shadow-card)",
                    }}
                  >
                    <span style={{ fontSize: 16 }}>{r.present ? "✅" : "❌"}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, flex: 1 }}>
                      {formatDate(r.date, { weekday: "short", day: "numeric", month: "short" })}
                    </span>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: r.present ? "var(--paid-green)" : "var(--overdue-coral)",
                    }}>
                      {r.present ? "Presente" : "Ausente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          );
        })}
    </div>
  );
}

const labelStyle: React.CSSProperties = {
  fontSize: 13, fontWeight: 600, color: "var(--text-secondary)",
  display: "block", marginBottom: 6,
};
const inputStyle: React.CSSProperties = {
  width: "100%", padding: "12px 14px", borderRadius: 12,
  border: "1.5px solid var(--border)", fontSize: 15,
  fontFamily: "var(--font)", marginBottom: 16,
  boxSizing: "border-box", background: "var(--surface)",
};

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const student = useQuery(api.students.getWithDetails, { id: id as Id<"students"> });
  const markPaid = useMutation(api.payments.markPaid);
  const markPending = useMutation(api.payments.markPending);
  const removeStudent = useMutation(api.students.remove);
  const config = useQuery(api.appConfig.getAll);

  const [tab, setTab] = useState("info");
  const [showAddPayment, setShowAddPayment] = useState(false);

  const currency = config?.currency ?? "Bs";

  if (student === undefined) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontFamily: "var(--font)" }}>Cargando...</div>;
  }
  if (student === null) {
    return <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontFamily: "var(--font)" }}>Alumno no encontrado</div>;
  }

  const handleDelete = async () => {
    if (!confirm("¿Eliminar este alumno? Esta acción no se puede deshacer.")) return;
    await removeStudent({ id: student._id });
    router.push("/alumnos");
  };

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px 0", background: "var(--white)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", gap: 12, marginBottom: 12 }}>
          <button
            onClick={() => router.back()}
            style={{
              width: 36, height: 36, borderRadius: "50%",
              background: "var(--surface-2)", border: "none", cursor: "pointer",
              display: "flex", alignItems: "center", justifyContent: "center",
              fontSize: 18, flexShrink: 0,
            }}
          >←</button>
          <div style={{ flex: 1, fontSize: 17, fontWeight: 700, overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>
            {student.name}
          </div>
          <Link href={`/alumnos/${student._id}/editar`}>
            <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pool-blue)", background: "var(--pool-light)", borderRadius: 8, padding: "6px 14px" }}>
              Editar
            </div>
          </Link>
        </div>
        <div style={{ paddingBottom: 12 }}>
          <SegmentedControl
            options={[
              { value: "info", label: "Info" },
              { value: "pagos", label: "Pagos" },
              { value: "asistencia", label: "Asistencia" },
            ]}
            value={tab}
            onChange={setTab}
          />
        </div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 14 }}>

        {/* INFO TAB */}
        {tab === "info" && (
          <>
            <Card padding="20px">
              <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
                <Avatar name={student.name} size={64} />
                <div>
                  <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{student.name}</div>
                  <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{student.timeSlot?.label ?? "Sin horario"}</div>
                  <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                    <Badge variant={student.modality as "lmv"|"mj"|"aquagym3x"|"aquagym5x"} size="sm" label={MODALITY_LABELS[student.modality]} />
                    <Badge variant={student.status as "active"|"suspended"|"withdrawn"} size="sm" />
                  </div>
                </div>
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {[
                  { icon: "📞", label: "Teléfono", value: student.phone },
                  { icon: "🎂", label: "Nacimiento", value: formatDate(student.dob) },
                  { icon: "📅", label: "Inscripción", value: formatDate(student.enrollmentDate) },
                ].map(row => (
                  <div key={row.label} style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 16, width: 24, textAlign: "center" }}>{row.icon}</span>
                    <span style={{ fontSize: 13, color: "var(--text-secondary)", width: 90 }}>{row.label}</span>
                    <span style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{row.value}</span>
                  </div>
                ))}
              </div>
              {student.phone && (
                <a
                  href={buildWhatsAppUrl(student.phone, `Hola ${student.name} 👋, te contactamos desde Mística Escuela de Natación.`)}
                  target="_blank" rel="noopener noreferrer"
                  style={{
                    display: "flex", alignItems: "center", justifyContent: "center",
                    gap: 8, marginTop: 16, padding: "10px",
                    background: "#25D366", color: "#fff", borderRadius: 10,
                    fontSize: 13, fontWeight: 700, textDecoration: "none",
                    fontFamily: "var(--font)",
                  }}
                >
                  <span style={{ fontSize: 16 }}>📲</span> WhatsApp
                </a>
              )}
            </Card>

            {student.attendanceRate !== null && (
              <Card padding="16px">
                <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Asistencia (últimos 30 días)</div>
                <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
                  <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${student.attendanceRate}%`,
                      background: student.attendanceRate >= 70 ? "var(--paid-green)" : student.attendanceRate >= 50 ? "var(--pending-amber)" : "var(--overdue-coral)",
                      borderRadius: 99, transition: "width 0.5s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 18, fontWeight: 800, minWidth: 48, textAlign: "right" }}>{student.attendanceRate}%</span>
                </div>
              </Card>
            )}

            <Card variant="flat" padding="16px" style={{ borderColor: "#FECACA" }}>
              <div style={{ fontSize: 13, fontWeight: 700, color: "var(--overdue-coral)", marginBottom: 10 }}>Zona de peligro</div>
              <Button variant="danger" fullWidth onClick={handleDelete}>Eliminar alumno</Button>
            </Card>
          </>
        )}

        {/* PAGOS TAB */}
        {tab === "pagos" && (
          <>
            <button
              onClick={() => setShowAddPayment(true)}
              style={{
                width: "100%", padding: "13px",
                background: "var(--pool-blue)", color: "#fff",
                border: "none", borderRadius: 12, fontSize: 14, fontWeight: 700,
                cursor: "pointer", fontFamily: "var(--font)",
              }}
            >+ Registrar pago</button>

            {student.payments.length === 0 ? (
              <div style={{ textAlign: "center", padding: "32px 0", color: "var(--text-secondary)", fontSize: 14 }}>
                Sin cobros registrados
              </div>
            ) : (
              <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
                {student.payments.map(payment => {
                  const rel = getRelativeDays(payment.dueDate);
                  const isPaid = payment.status === "paid";
                  const isOverdue = payment.status !== "paid" && rel.urgency === "overdue";
                  const concepto = payment.type === "enrollment"
                    ? "Inscripción"
                    : `Mensualidad${payment.month ? " " + formatMonth(payment.month) : ""}`;

                  return (
                    <Card
                      key={payment._id}
                      variant={isOverdue ? "overdue" : "default"}
                      padding="14px 16px"
                    >
                      <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                        <div style={{ flex: 1, minWidth: 0 }}>
                          <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                            {concepto}
                          </div>
                          <div style={{
                            fontSize: 12, marginTop: 2, fontWeight: 600,
                            color: isPaid ? "var(--paid-green)" : isOverdue ? "var(--overdue-coral)" : rel.urgency === "soon" ? "var(--pending-amber)" : "var(--text-secondary)",
                          }}>
                            {isPaid ? `Pagado ${payment.paidAt ? formatDate(payment.paidAt) : ""}` : rel.label}
                          </div>
                        </div>
                        <div style={{ display: "flex", alignItems: "center", gap: 10, flexShrink: 0 }}>
                          <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>
                            {formatCurrency(payment.amount, currency)}
                          </span>
                          {!isPaid ? (
                            <button
                              onClick={() => markPaid({ id: payment._id })}
                              style={{
                                background: "var(--paid-green)", color: "#fff", border: "none",
                                borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", fontFamily: "var(--font)",
                              }}
                            >✓ Pago</button>
                          ) : (
                            <button
                              onClick={() => markPending({ id: payment._id })}
                              style={{
                                background: "var(--surface-2)", color: "var(--text-secondary)", border: "none",
                                borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600,
                                cursor: "pointer", fontFamily: "var(--font)",
                              }}
                            >↩</button>
                          )}
                        </div>
                      </div>
                    </Card>
                  );
                })}
              </div>
            )}
          </>
        )}

        {/* ASISTENCIA TAB */}
        {tab === "asistencia" && (
          <AttendanceTab studentId={student._id} />
        )}
      </div>

      {showAddPayment && (
        <AddPaymentSheet
          studentId={student._id}
          currency={currency}
          onClose={() => setShowAddPayment(false)}
        />
      )}
    </div>
  );
}

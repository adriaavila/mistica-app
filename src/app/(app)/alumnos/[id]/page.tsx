"use client";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import Button from "@/components/ui/Button";
import Card from "@/components/ui/Card";
import { MODALITY_LABELS, formatDate, formatCurrency, getRelativeDays } from "@/lib/utils";
import Link from "next/link";
import { Id } from "../../../../../convex/_generated/dataModel";

export default function StudentDetailPage() {
  const { id } = useParams();
  const router = useRouter();
  const student = useQuery(api.students.getWithDetails, { id: id as Id<"students"> });
  const markPaid = useMutation(api.payments.markPaid);
  const markPending = useMutation(api.payments.markPending);
  const removeStudent = useMutation(api.students.remove);

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
      <div style={{ padding: "16px 20px 12px", background: "var(--white)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10, display: "flex", alignItems: "center", gap: 12 }}>
        <button onClick={() => router.back()} style={{ width: 36, height: 36, borderRadius: "50%", background: "var(--surface-2)", border: "none", cursor: "pointer", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18, flexShrink: 0 }}>←</button>
        <div style={{ flex: 1, fontSize: 17, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{student.name}</div>
        <Link href={`/alumnos/${student._id}/editar`}>
          <div style={{ fontSize: 13, fontWeight: 600, color: "var(--pool-blue)", background: "var(--pool-light)", borderRadius: 8, padding: "6px 14px" }}>Editar</div>
        </Link>
      </div>

      <div style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        {/* Profile */}
        <Card padding="20px">
          <div style={{ display: "flex", alignItems: "center", gap: 16, marginBottom: 16 }}>
            <Avatar name={student.name} size={64} />
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{student.name}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 4 }}>{student.timeSlot?.label ?? "Sin horario"}</div>
              <div style={{ display: "flex", gap: 6, marginTop: 8 }}>
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
        </Card>

        {/* Attendance rate */}
        {student.attendanceRate !== null && (
          <Card padding="16px">
            <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Asistencia (últimos 30 días)</div>
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <div style={{ flex: 1, height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                <div style={{ height: "100%", width: `${student.attendanceRate}%`, background: student.attendanceRate >= 70 ? "var(--paid-green)" : student.attendanceRate >= 50 ? "var(--pending-amber)" : "var(--overdue-coral)", borderRadius: 99, transition: "width 0.5s ease" }} />
              </div>
              <span style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)", minWidth: 48, textAlign: "right" }}>{student.attendanceRate}%</span>
            </div>
          </Card>
        )}

        {/* Payments */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 10 }}>Cobros</div>
          {student.payments.length === 0 ? (
            <Card padding="20px"><div style={{ textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>Sin cobros registrados</div></Card>
          ) : (
            <div style={{ display: "flex", flexDirection: "column", gap: 8 }}>
              {student.payments.map(payment => {
                const rel = getRelativeDays(payment.dueDate);
                return (
                  <Card key={payment._id} variant={payment.status === "overdue" || (payment.status !== "paid" && rel.urgency === "overdue") ? "overdue" : "default"} padding="14px 16px">
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>
                          {payment.type === "enrollment" ? "Inscripción" : `Mensualidad${payment.month ? " " + payment.month.split("-").reverse().join("/") : ""}`}
                        </div>
                        <div style={{ fontSize: 12, color: payment.status === "paid" ? "var(--paid-green)" : rel.urgency === "overdue" ? "var(--overdue-coral)" : "var(--text-secondary)", marginTop: 2 }}>
                          {payment.status === "paid" ? `Pagado ${payment.paidAt ? formatDate(payment.paidAt) : ""}` : rel.label}
                        </div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{formatCurrency(payment.amount)}</span>
                        {payment.status !== "paid" ? (
                          <button onClick={() => markPaid({ id: payment._id })} style={{ background: "var(--paid-green)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}>✓ Pago</button>
                        ) : (
                          <button onClick={() => markPending({ id: payment._id })} style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}>↩</button>
                        )}
                      </div>
                    </div>
                  </Card>
                );
              })}
            </div>
          )}
        </div>

        {/* Danger zone */}
        <Card variant="flat" padding="16px" style={{ marginTop: 8, borderColor: "#FECACA" }}>
          <div style={{ fontSize: 13, fontWeight: 700, color: "var(--overdue-coral)", marginBottom: 10 }}>Zona de peligro</div>
          <Button variant="danger" fullWidth onClick={handleDelete}>Eliminar alumno</Button>
        </Card>
      </div>
    </div>
  );
}

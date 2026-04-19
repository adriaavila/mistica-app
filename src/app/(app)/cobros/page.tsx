"use client";
import { useState, useMemo } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSearchParams } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import SegmentedControl from "@/components/ui/SegmentedControl";
import EmptyState from "@/components/ui/EmptyState";
import { formatCurrency, formatDate, getRelativeDays } from "@/lib/utils";
import { Id } from "../../../../convex/_generated/dataModel";
import { Suspense } from "react";

function CobrosContent() {
  const searchParams = useSearchParams();
  const initialFilter = searchParams.get("filter") ?? "all";
  const [filter, setFilter] = useState(initialFilter);

  const payments = useQuery(api.payments.listAll, {});
  const markPaid = useMutation(api.payments.markPaid);
  const markPending = useMutation(api.payments.markPending);

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
      .sort((a, b) => {
        const order = { overdue: 0, pending: 1, paid: 2 };
        const oa = order[a.effectiveStatus] ?? 1;
        const ob = order[b.effectiveStatus] ?? 1;
        if (oa !== ob) return oa - ob;
        return a.dueDate.localeCompare(b.dueDate);
      });
  }, [payments, filter]);

  const overdueCount = payments?.filter(p => p.status !== "paid" && p.dueDate < new Date().toISOString().split("T")[0]).length ?? 0;

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", background: "var(--white)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Cobros</div>
          {overdueCount > 0 && (
            <div style={{ background: "var(--overdue-light)", borderRadius: 99, padding: "4px 12px", fontSize: 12, fontWeight: 700, color: "var(--overdue-coral)" }}>
              {overdueCount} en mora
            </div>
          )}
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
                  boxShadow: "var(--shadow-card)", borderLeft: isOverdue ? "3px solid var(--overdue-coral)" : undefined,
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
                  <div style={{ fontSize: 12, marginTop: 3, color: isPaid ? "var(--paid-green)" : isOverdue ? "var(--overdue-coral)" : rel.urgency === "soon" ? "var(--pending-amber)" : "var(--text-secondary)", fontWeight: 600 }}>
                    {isPaid ? `Pagado ${payment.paidAt ? formatDate(payment.paidAt) : ""}` : rel.label}
                  </div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 6, flexShrink: 0 }}>
                  <span style={{ fontSize: 16, fontWeight: 800, color: "var(--text-primary)" }}>{formatCurrency(payment.amount)}</span>
                  {!isPaid ? (
                    <button
                      onClick={() => markPaid({ id: payment._id as Id<"payments"> })}
                      style={{ background: "var(--paid-green)", color: "#fff", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 700, cursor: "pointer", fontFamily: "var(--font)" }}
                    >✓ Pago</button>
                  ) : (
                    <button
                      onClick={() => markPending({ id: payment._id as Id<"payments"> })}
                      style={{ background: "var(--surface-2)", color: "var(--text-secondary)", border: "none", borderRadius: 8, padding: "6px 12px", fontSize: 12, fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)" }}
                    >↩ Revertir</button>
                  )}
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}

export default function CobrosPage() {
  return <Suspense><CobrosContent /></Suspense>;
}

"use client";
import { useQuery } from "convex/react";
import { api } from "../../../convex/_generated/api";

export default function DiagnosticoPage() {
  const students = useQuery(api.students.list);
  const classes = useQuery(api.classes.list);
  const slots = useQuery(api.timeSlots.list);
  const payments = useQuery(api.payments.listAll);
  const stats = useQuery(api.payments.getDashboardStats);
  const analytics = useQuery(api.payments.getAnalytics);

  return (
    <div style={{ fontFamily: "var(--font)", padding: 20 }}>
      <h1 style={{ fontSize: 22, fontWeight: 800, marginBottom: 20 }}>Diagnóstico de datos</h1>

      <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 20 }}>
        <DataCard label="Alumnos" value={students?.length} loading={students === undefined} />
        <DataCard label="Clases" value={classes?.length} loading={classes === undefined} />
        <DataCard label="Horarios" value={slots?.length} loading={slots === undefined} />
        <DataCard label="Pagos" value={payments?.length} loading={payments === undefined} />
      </div>

      {stats && (
        <div style={{ background: "var(--white)", borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Dashboard Stats</div>
          <pre style={{ fontSize: 12, overflow: "auto" }}>{JSON.stringify(stats, null, 2)}</pre>
        </div>
      )}

      {analytics && (
        <div style={{ background: "var(--white)", borderRadius: 16, padding: 16, marginBottom: 20, boxShadow: "var(--shadow-card)" }}>
          <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>Analytics</div>
          <pre style={{ fontSize: 12, overflow: "auto" }}>{JSON.stringify(analytics, null, 2)}</pre>
        </div>
      )}

      <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
        <DataSection title="Clases" data={classes} renderItem={(c: any) => (
          <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <strong>{c.name}</strong> ({c.key}) — {c.isActive ? "Activa" : "Inactiva"}
          </div>
        )} />

        <DataSection title="Horarios" data={slots} renderItem={(s: any) => (
          <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <strong>{s.label}</strong> — {s.startTime} a {s.endTime} — {s.isActive ? "Activo" : "Inactivo"}
          </div>
        )} />

        <DataSection title="Alumnos (primeros 10)" data={students?.slice(0, 10)} renderItem={(s: any) => (
          <div style={{ padding: "8px 0", borderBottom: "1px solid var(--border)" }}>
            <strong>{s.name}</strong> — {s.modality} — {s.status}
          </div>
        )} />
      </div>
    </div>
  );
}

function DataCard({ label, value, loading }: { label: string; value?: number; loading: boolean }) {
  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow-card)", textAlign: "center" }}>
      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginBottom: 4 }}>{label}</div>
      <div style={{ fontSize: 28, fontWeight: 800, color: "var(--pool-blue)" }}>
        {loading ? "…" : value ?? 0}
      </div>
    </div>
  );
}

function DataSection({ title, data, renderItem }: { title: string; data?: any[]; renderItem: (item: any) => React.ReactNode }) {
  return (
    <div style={{ background: "var(--white)", borderRadius: 16, padding: 16, boxShadow: "var(--shadow-card)" }}>
      <div style={{ fontSize: 14, fontWeight: 700, marginBottom: 10 }}>{title} ({data?.length ?? "…"})</div>
      {data === undefined ? (
        <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Cargando…</div>
      ) : data.length === 0 ? (
        <div style={{ color: "var(--text-secondary)", fontSize: 14 }}>Sin datos</div>
      ) : (
        <div>{data.map((item, i) => <div key={i}>{renderItem(item)}</div>)}</div>
      )}
    </div>
  );
}

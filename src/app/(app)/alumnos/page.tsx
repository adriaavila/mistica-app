"use client";
import { Suspense, useMemo } from "react";
import { useQuery } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import Badge from "@/components/ui/Badge";
import EmptyState from "@/components/ui/EmptyState";
import SegmentedControl from "@/components/ui/SegmentedControl";
import { MODALITY_SHORT, MODALITY_LABELS, MODALITY_COLORS } from "@/lib/utils";

function AlumnosContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const filter = searchParams.get("filter") ?? "all";
  const search = searchParams.get("q") ?? "";

  const setUrlParam = (key: string, value: string, defaultValue = "") => {
    const params = new URLSearchParams(searchParams);
    if (!value || value === defaultValue) params.delete(key);
    else params.set(key, value);
    const qs = params.toString();
    router.replace(qs ? `${pathname}?${qs}` : pathname, { scroll: false });
  };

  const students = useQuery(api.students.listWithDetails, {
    status: filter === "all" ? undefined : filter,
  });
  const classes = useQuery(api.classes.list, {});

  const classMap = useMemo(() => {
    const map: Record<string, { name: string; bg: string; color: string }> = {};
    classes?.forEach(c => {
      map[c.key] = { name: c.name, bg: "var(--pool-light)", color: "var(--pool-blue)" };
    });
    // Fallback for hardcoded known keys
    Object.entries(MODALITY_LABELS).forEach(([key, name]) => {
      if (!map[key]) {
        const colors = MODALITY_COLORS[key] ?? { bg: "var(--pool-light)", color: "var(--pool-blue)" };
        map[key] = { name, bg: colors.bg, color: colors.color };
      }
    });
    return map;
  }, [classes]);

  const filtered = useMemo(() => {
    if (!students) return [];
    if (!search.trim()) return students;
    const q = search.toLowerCase();
    return students.filter(s => s.name.toLowerCase().includes(q) || s.phone.includes(q));
  }, [students, search]);

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 0", background: "var(--white)", borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10 }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 14 }}>
          <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Alumnos</div>
          <Link href="/alumnos/nuevo">
            <div style={{ width: 38, height: 38, borderRadius: "50%", background: "var(--pool-blue)", display: "flex", alignItems: "center", justifyContent: "center", color: "#fff", fontSize: 22, fontWeight: 300, lineHeight: 1 }}>+</div>
          </Link>
        </div>
        {/* Search */}
        <div style={{ position: "relative", marginBottom: 12 }}>
          <span style={{ position: "absolute", left: 14, top: "50%", transform: "translateY(-50%)", fontSize: 16, color: "var(--text-secondary)" }}>🔍</span>
          <input
            aria-label="Buscar alumno"
            name="q"
            autoComplete="off"
            placeholder="Buscar alumno…"
            value={search}
            onChange={e => setUrlParam("q", e.target.value)}
            onFocus={e => { e.currentTarget.style.borderColor = "var(--pool-blue)"; e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
            onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
            style={{ width: "100%", height: 44, borderRadius: 12, border: "1.5px solid var(--border)", background: "var(--surface)", padding: "0 14px 0 40px", fontFamily: "var(--font)", fontSize: 14, outline: "none", color: "var(--text-primary)", boxSizing: "border-box", transition: "border-color 0.15s ease, box-shadow 0.15s ease" }}
          />
        </div>
        {/* Filter */}
        <div style={{ paddingBottom: 12 }}>
          <SegmentedControl
            fullWidth
            options={[
              { value: "all", label: "Todos" },
              { value: "active", label: "Activos" },
              { value: "suspended", label: "Suspendidos" },
              { value: "withdrawn", label: "Retirados" },
            ]}
            value={filter}
            onChange={(value) => setUrlParam("filter", value, "all")}
          />
        </div>
      </div>

      {/* List */}
      <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!students ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 72, borderRadius: 16, background: "var(--surface-2)", animation: "pulse 1.5s infinite" }} />
          ))
        ) : filtered.length === 0 ? (
          <EmptyState emoji="👥" title="Sin alumnos" description={search ? "No se encontraron resultados" : "Agrega tu primer alumno con el botón +"} action={!search && <Link href="/alumnos/nuevo"><div style={{ background: "var(--pool-blue)", color: "#fff", borderRadius: 12, padding: "10px 20px", fontWeight: 600, fontSize: 14 }}>+ Nuevo alumno</div></Link>} />
        ) : (
          filtered.map(student => (
            <Link key={student._id} href={`/alumnos/${student._id}`} style={{ textDecoration: "none" }}>
              <div style={{
                background: "var(--white)",
                borderRadius: 16,
                padding: "12px 14px",
                boxShadow: "var(--shadow-card)",
                display: "flex",
                alignItems: "center",
                gap: 12,
                borderLeft: student.paymentStatus === "overdue" ? "3px solid var(--overdue-coral)" : undefined,
                opacity: student.status === "withdrawn" ? 0.6 : 1,
              }}>
                <Avatar name={student.name} size={44} src={student.photo} />
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{student.name}</div>
                  <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{student.timeSlot?.label ?? "Sin horario"}</div>
                </div>
                <div style={{ display: "flex", flexDirection: "column", alignItems: "flex-end", gap: 4, flexShrink: 0 }}>
                  <Badge size="sm" label={classMap[student.modality]?.name ?? MODALITY_SHORT[student.modality] ?? student.modality} bg={classMap[student.modality]?.bg} color={classMap[student.modality]?.color} />
                  <div style={{ display: "flex", gap: 4 }}>
                    {student.status !== "active" && (
                      <Badge variant={student.status as "suspended" | "withdrawn"} size="sm" />
                    )}
                    <Badge variant={student.paymentStatus as "paid" | "pending" | "overdue"} size="sm" />
                  </div>
                </div>
                <span style={{ color: "var(--text-secondary)", fontSize: 16, marginLeft: 4 }}>›</span>
              </div>
            </Link>
          ))
        )}
      </div>
      <style>{`@keyframes pulse { 0%,100%{opacity:1} 50%{opacity:0.5} }`}</style>
    </div>
  );
}

export default function AlumnosPage() {
  return (
    <Suspense>
      <AlumnosContent />
    </Suspense>
  );
}

"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { Id } from "../../../../../convex/_generated/dataModel";
import { useRouter } from "next/navigation";
import EmptyState from "@/components/ui/EmptyState";
import { DAY_LABELS } from "@/lib/utils";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const ALL_MODALITIES = [
  { value: "lmv",       label: "Natación LMV" },
  { value: "mj",        label: "Natación MJ" },
  { value: "aquagym3x", label: "Aqua Gym 3x" },
  { value: "aquagym5x", label: "Aqua Gym 5x" },
];

type Slot = {
  _id: Id<"timeSlots">;
  label: string;
  days: string[];
  startTime: string;
  endTime: string;
  isActive: boolean;
  maxCapacity: number;
  modalities: string[];
  studentCount?: number;
};

type FormState = {
  label: string;
  days: string[];
  startTime: string;
  endTime: string;
  maxCapacity: number;
  modalities: string[];
  isActive: boolean;
};

const EMPTY_FORM: FormState = {
  label: "",
  days: [],
  startTime: "08:00",
  endTime: "09:00",
  maxCapacity: 15,
  modalities: [],
  isActive: true,
};

function SlotForm({
  initial,
  onSave,
  onClose,
  onDelete,
  saving,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
}) {
  const [form, setForm] = useState<FormState>(initial);

  const toggleDay = (day: string) =>
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));

  const toggleModality = (m: string) =>
    setForm(f => ({
      ...f,
      modalities: f.modalities.includes(m) ? f.modalities.filter(x => x !== m) : [...f.modalities, m],
    }));

  const valid = form.label.trim() && form.days.length > 0 && form.modalities.length > 0;

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
          borderRadius: "20px 20px 0 0", maxHeight: "90dvh",
          overflowY: "auto", fontFamily: "var(--font)",
          padding: "24px 20px calc(28px + env(safe-area-inset-bottom))",
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {/* Label */}
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>
          {initial.label ? "Editar horario" : "Nuevo horario"}
        </div>

        <label style={labelStyle}>Nombre del horario</label>
        <input
          value={form.label}
          onChange={(e) => setForm(f => ({ ...f, label: e.target.value }))}
          placeholder="Ej. LMV 6–7 pm"
          style={inputStyle}
        />

        {/* Days */}
        <label style={labelStyle}>Días</label>
        <div style={{ display: "flex", gap: 8, flexWrap: "wrap", marginBottom: 16 }}>
          {ALL_DAYS.map(day => (
            <button
              key={day}
              onClick={() => toggleDay(day)}
              style={{
                padding: "7px 12px", borderRadius: 10, fontSize: 13, fontWeight: 600,
                border: "1.5px solid",
                borderColor: form.days.includes(day) ? "var(--pool-blue)" : "var(--border)",
                background: form.days.includes(day) ? "var(--pool-light)" : "transparent",
                color: form.days.includes(day) ? "var(--pool-blue)" : "var(--text-secondary)",
                cursor: "pointer", fontFamily: "var(--font)",
              }}
            >{DAY_LABELS[day]}</button>
          ))}
        </div>

        {/* Times */}
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Hora inicio</label>
            <input
              type="time" value={form.startTime}
              onChange={(e) => setForm(f => ({ ...f, startTime: e.target.value }))}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Hora fin</label>
            <input
              type="time" value={form.endTime}
              onChange={(e) => setForm(f => ({ ...f, endTime: e.target.value }))}
              style={inputStyle}
            />
          </div>
        </div>

        {/* Capacity */}
        <label style={labelStyle}>Capacidad máxima</label>
        <input
          type="number" value={form.maxCapacity}
          onChange={(e) => setForm(f => ({ ...f, maxCapacity: parseInt(e.target.value) || 1 }))}
          style={inputStyle}
        />

        {/* Modalities */}
        <label style={labelStyle}>Modalidades</label>
        <div style={{ display: "flex", flexDirection: "column", gap: 8, marginBottom: 16 }}>
          {ALL_MODALITIES.map(m => (
            <label key={m.value} style={{ display: "flex", alignItems: "center", gap: 10, cursor: "pointer" }}>
              <input
                type="checkbox"
                checked={form.modalities.includes(m.value)}
                onChange={() => toggleModality(m.value)}
                style={{ width: 18, height: 18, accentColor: "var(--pool-blue)" }}
              />
              <span style={{ fontSize: 14, fontWeight: 500 }}>{m.label}</span>
            </label>
          ))}
        </div>

        {/* Active toggle */}
        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, cursor: "pointer" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Horario activo</span>
          <div
            onClick={() => setForm(f => ({ ...f, isActive: !f.isActive }))}
            style={{
              width: 48, height: 28, borderRadius: 99,
              background: form.isActive ? "var(--paid-green)" : "var(--border)",
              position: "relative", transition: "background 0.2s", cursor: "pointer",
            }}
          >
            <div style={{
              position: "absolute", top: 3, left: form.isActive ? 23 : 3,
              width: 22, height: 22, borderRadius: "50%",
              background: "#fff", transition: "left 0.2s",
              boxShadow: "0 1px 4px rgba(0,0,0,0.2)",
            }} />
          </div>
        </label>

        <button
          onClick={() => onSave(form)}
          disabled={!valid || saving}
          style={{
            width: "100%", padding: "14px",
            background: !valid || saving ? "var(--surface-2)" : "var(--pool-blue)",
            color: !valid || saving ? "var(--text-secondary)" : "#fff",
            border: "none", borderRadius: 12, fontSize: 15, fontWeight: 700,
            cursor: !valid || saving ? "default" : "pointer", fontFamily: "var(--font)",
          }}
        >{saving ? "Guardando…" : "Guardar"}</button>

        {onDelete && (
          <button
            onClick={onDelete}
            style={{
              width: "100%", marginTop: 10, padding: "12px",
              background: "none", border: "none",
              color: "var(--overdue-coral)", fontSize: 14,
              fontWeight: 600, cursor: "pointer", fontFamily: "var(--font)",
            }}
          >Eliminar horario</button>
        )}
      </div>
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

export default function HorariosPage() {
  const router = useRouter();
  const slots = useQuery(api.timeSlots.listWithCapacity);
  const createSlot = useMutation(api.timeSlots.create);
  const updateSlot = useMutation(api.timeSlots.update);
  const removeSlot = useMutation(api.timeSlots.remove);

  const [editing, setEditing] = useState<Slot | null | "new">(null);
  const [saving, setSaving] = useState(false);

  const handleSave = async (form: FormState) => {
    setSaving(true);
    if (editing === "new") {
      await createSlot(form);
    } else if (editing) {
      await updateSlot({ id: editing._id, ...form });
    }
    setSaving(false);
    setEditing(null);
  };

  const handleDelete = async (id: Id<"timeSlots">) => {
    if (!confirm("¿Eliminar este horario? Los alumnos asignados quedarán sin horario.")) return;
    await removeSlot({ id });
    setEditing(null);
  };

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{
        padding: "16px 20px", background: "var(--white)",
        borderBottom: "1px solid var(--border)",
        position: "sticky", top: 0, zIndex: 10,
        display: "flex", alignItems: "center", gap: 12,
      }}>
        <button
          onClick={() => router.back()}
          style={{
            width: 36, height: 36, borderRadius: "50%",
            background: "var(--surface-2)", border: "none", cursor: "pointer",
            display: "flex", alignItems: "center", justifyContent: "center", fontSize: 18,
          }}
        >←</button>
        <div style={{ flex: 1, fontSize: 20, fontWeight: 800 }}>Horarios</div>
        <button
          onClick={() => setEditing("new")}
          style={{
            background: "var(--pool-light)", borderRadius: 99, padding: "6px 14px",
            fontSize: 13, fontWeight: 700, color: "var(--pool-blue)",
            border: "none", cursor: "pointer", fontFamily: "var(--font)",
          }}
        >+ Nuevo</button>
      </div>

      <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {!slots ? (
          Array.from({ length: 5 }).map((_, i) => (
            <div key={i} style={{ height: 80, borderRadius: 16, background: "var(--surface-2)" }} />
          ))
        ) : slots.length === 0 ? (
          <EmptyState emoji="⏰" title="Sin horarios" description="Toca + Nuevo para crear uno" />
        ) : (
          slots.map(slot => {
            const pct = slot.maxCapacity > 0
              ? Math.round(((slot.studentCount ?? 0) / slot.maxCapacity) * 100)
              : 0;
            const capacityColor = pct >= 90
              ? "var(--overdue-coral)"
              : pct >= 70
              ? "var(--pending-amber)"
              : "var(--paid-green)";

            return (
              <div
                key={slot._id}
                onClick={() => setEditing(slot as Slot)}
                style={{
                  background: "var(--white)", borderRadius: 16, padding: "14px 16px",
                  boxShadow: "var(--shadow-card)", cursor: "pointer",
                  opacity: slot.isActive ? 1 : 0.5,
                  borderLeft: !slot.isActive ? "3px solid var(--border)" : undefined,
                }}
              >
                <div style={{ display: "flex", alignItems: "flex-start", justifyContent: "space-between", marginBottom: 8 }}>
                  <div>
                    <div style={{ fontSize: 15, fontWeight: 700, color: "var(--text-primary)" }}>
                      {slot.label}
                    </div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 3 }}>
                      {slot.startTime} – {slot.endTime} · {slot.days.map(d => DAY_LABELS[d] ?? d).join(", ")}
                    </div>
                  </div>
                  {!slot.isActive && (
                    <span style={{
                      fontSize: 11, fontWeight: 700, color: "var(--text-secondary)",
                      background: "var(--surface-2)", borderRadius: 6, padding: "3px 8px",
                    }}>Inactivo</span>
                  )}
                </div>

                {/* Capacity bar */}
                <div style={{ display: "flex", alignItems: "center", gap: 8 }}>
                  <div style={{ flex: 1, height: 6, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
                    <div style={{
                      height: "100%", width: `${Math.min(pct, 100)}%`,
                      background: capacityColor, borderRadius: 99,
                      transition: "width 0.4s ease",
                    }} />
                  </div>
                  <span style={{ fontSize: 12, fontWeight: 700, color: capacityColor, minWidth: 52, textAlign: "right" }}>
                    {slot.studentCount ?? 0}/{slot.maxCapacity}
                  </span>
                </div>

                {/* Modalities */}
                <div style={{ display: "flex", gap: 6, marginTop: 8, flexWrap: "wrap" }}>
                  {slot.modalities.map(m => (
                    <span key={m} style={{
                      fontSize: 11, fontWeight: 600, padding: "3px 8px", borderRadius: 6,
                      background: "var(--pool-light)", color: "var(--pool-blue)",
                    }}>{m.toUpperCase()}</span>
                  ))}
                </div>
              </div>
            );
          })
        )}
      </div>

      {editing && (
        <SlotForm
          initial={editing === "new" ? EMPTY_FORM : {
            label: editing.label,
            days: editing.days,
            startTime: editing.startTime,
            endTime: editing.endTime,
            maxCapacity: editing.maxCapacity,
            modalities: editing.modalities,
            isActive: editing.isActive,
          }}
          onSave={handleSave}
          onClose={() => setEditing(null)}
          onDelete={editing !== "new" ? () => handleDelete(editing._id) : undefined}
          saving={saving}
        />
      )}
    </div>
  );
}

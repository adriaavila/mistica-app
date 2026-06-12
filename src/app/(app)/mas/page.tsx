"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { Id } from "../../../../convex/_generated/dataModel";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { todayStr } from "@/lib/utils";

const ALL_DAYS = ["Mon", "Tue", "Wed", "Thu", "Fri", "Sat", "Sun"] as const;
const DAY_LABELS: Record<string, string> = {
  Mon:"Lun", Tue:"Mar", Wed:"Mié", Thu:"Jue", Fri:"Vie", Sat:"Sáb", Sun:"Dom",
};

type ClassDoc = {
  _id: Id<"classes">;
  key: string;
  name: string;
  description: string;
  price: number;
  isActive: boolean;
  days: string[];
  startTime: string;
  endTime: string;
};

type FormState = {
  key: string;
  name: string;
  description: string;
  price: string;
  isActive: boolean;
  days: string[];
  startTime: string;
  endTime: string;
};

const EMPTY_FORM: FormState = {
  key: "",
  name: "",
  description: "",
  price: "",
  isActive: true,
  days: [],
  startTime: "08:00",
  endTime: "09:00",
};

function addOneHour(time: string) {
  const [hours = "0", minutes = "0"] = time.split(":");
  const nextHour = (parseInt(hours, 10) + 1) % 24;
  return `${String(nextHour).padStart(2, "0")}:${minutes.padStart(2, "0")}`;
}

function ClassForm({
  initial,
  onSave,
  onClose,
  onDelete,
  saving,
  isNew,
}: {
  initial: FormState;
  onSave: (f: FormState) => void;
  onClose: () => void;
  onDelete?: () => void;
  saving: boolean;
  isNew: boolean;
}) {
  const [form, setForm] = useState<FormState>({
    ...initial,
    endTime: addOneHour(initial.startTime),
  });

  const setStartTime = (startTime: string) =>
    setForm(f => ({ ...f, startTime, endTime: addOneHour(startTime) }));

  const toggleDay = (day: string) =>
    setForm(f => ({
      ...f,
      days: f.days.includes(day) ? f.days.filter(d => d !== day) : [...f.days, day],
    }));

  const valid = form.key.trim() && form.name.trim() && form.days.length > 0 && parseFloat(form.price) > 0;

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
        <div style={{ fontSize: 18, fontWeight: 800, marginBottom: 20 }}>
          {isNew ? "Nueva clase" : "Editar clase"}
        </div>

        {isNew && (
          <>
            <label style={labelStyle}>Clave única (sin espacios)</label>
            <input
              value={form.key}
              onChange={(e) => setForm(f => ({ ...f, key: e.target.value.toLowerCase().replace(/\s/g, "") }))}
              placeholder="Ej. natacion_avanzada"
              style={inputStyle}
            />
          </>
        )}

        <label style={labelStyle}>Nombre</label>
        <input
          value={form.name}
          onChange={(e) => setForm(f => ({ ...f, name: e.target.value }))}
          placeholder="Ej. Natación Avanzada"
          style={inputStyle}
        />

        <label style={labelStyle}>Descripción</label>
        <input
          value={form.description}
          onChange={(e) => setForm(f => ({ ...f, description: e.target.value }))}
          placeholder="Ej. Mensualidad avanzada"
          style={inputStyle}
        />

        <label style={labelStyle}>Precio mensual</label>
        <input
          type="number"
          value={form.price}
          onChange={(e) => setForm(f => ({ ...f, price: e.target.value }))}
          placeholder="0"
          style={inputStyle}
        />

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

        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: 12, marginBottom: 16 }}>
          <div>
            <label style={labelStyle}>Hora inicio</label>
            <input
              type="time" value={form.startTime}
              onChange={(e) => setStartTime(e.target.value)}
              onInput={(e) => setStartTime(e.currentTarget.value)}
              style={inputStyle}
            />
          </div>
          <div>
            <label style={labelStyle}>Hora fin</label>
            <input
              type="time" value={form.endTime}
              readOnly
              style={inputStyle}
            />
          </div>
        </div>

        <label style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 24, cursor: "pointer" }}>
          <span style={{ fontSize: 14, fontWeight: 600 }}>Clase activa</span>
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
          >Eliminar clase</button>
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

export default function MasPage() {
  const config = useQuery(api.appConfig.getAll);
  const classes = useQuery(api.classes.list, {});
  const todaySlots = useQuery(api.attendance.getTodaySummary, { date: todayStr() });
  const setConfig = useMutation(api.appConfig.set);
  const createClass = useMutation(api.classes.create);
  const updateClass = useMutation(api.classes.update);
  const removeClass = useMutation(api.classes.remove);

  const [editing, setEditing] = useState<ClassDoc | null | "new">(null);
  const [saving, setSaving] = useState(false);

  const [editingAlert, setEditingAlert] = useState(false);
  const [editAlertValue, setEditAlertValue] = useState("");

  const handleSave = async (form: FormState) => {
    setSaving(true);
    if (editing === "new") {
      await createClass({
        key: form.key,
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        isActive: form.isActive,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
      });
    } else if (editing) {
      await updateClass({
        id: editing._id,
        name: form.name,
        description: form.description,
        price: parseFloat(form.price),
        isActive: form.isActive,
        days: form.days,
        startTime: form.startTime,
        endTime: form.endTime,
      });
    }
    setSaving(false);
    setEditing(null);
  };

  const handleDelete = async (id: Id<"classes">) => {
    if (!confirm("¿Eliminar esta clase? Los alumnos asignados seguirán con su modalidad, pero no podrás asignar nuevos alumnos a esta clase.")) return;
    await removeClass({ id });
    setEditing(null);
  };

  const saveAlert = async () => {
    setSaving(true);
    await setConfig({ key: "alert_days_before_due", value: editAlertValue });
    setSaving(false);
    setEditingAlert(false);
  };

  const startAlertEdit = () => {
    setEditingAlert(true);
    setEditAlertValue(config?.alert_days_before_due ?? "7");
  };

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{ padding: "20px 20px 16px", background: "var(--white)", borderBottom: "1px solid var(--border)" }}>
        <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Más</div>
      </div>

      <div style={{ padding: "16px 20px", display: "flex", flexDirection: "column", gap: 20 }}>

        {/* School info */}
        <Card padding="16px 20px">
          <div style={{ display: "flex", alignItems: "center", gap: 16 }}>
            <div style={{ width: 52, height: 52, borderRadius: 16, background: "var(--pool-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 28 }}>🏊</div>
            <div>
              <div style={{ fontSize: 18, fontWeight: 800, color: "var(--text-primary)" }}>{config?.school_name ?? "Mística"}</div>
              <div style={{ fontSize: 13, color: "var(--text-secondary)", marginTop: 2 }}>Escuela de natación</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", marginTop: 2 }}>Versión 1.0.0</div>
            </div>
          </div>
        </Card>

        {/* Quick nav */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Herramientas</div>
          <Card padding="0">
            {[
              { href: "/ventas", icon: "🛒", label: "Ventas de productos", desc: "Vende artículos y consulta historial" },
              { href: "/mas/horarios", icon: "⏰", label: "Horarios", desc: "Gestiona los horarios de clases" },
              { href: "/mkt", icon: "📣", label: "Campañas WhatsApp", desc: "Envía mensajes y saludos a tus alumnos" },
            ].map((item, idx) => (
              <div key={item.href}>
                {idx > 0 && <div style={{ height: 1, background: "var(--border)", margin: "0 16px" }} />}
                <Link href={item.href} style={{ textDecoration: "none" }}>
                  <div style={{ padding: "14px 16px", display: "flex", alignItems: "center", gap: 14 }}>
                    <div style={{ width: 40, height: 40, borderRadius: 12, background: "var(--pool-light)", display: "flex", alignItems: "center", justifyContent: "center", fontSize: 20, flexShrink: 0 }}>
                      {item.icon}
                    </div>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)" }}>{item.label}</div>
                      <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{item.desc}</div>
                    </div>
                    <span style={{ color: "var(--text-secondary)", fontSize: 16 }}>›</span>
                  </div>
                </Link>
              </div>
            ))}
          </Card>
        </div>

        {/* Classes */}
        <div>
          <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
            <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)" }}>Clases</div>
            <button
              onClick={() => setEditing("new")}
              style={{
                background: "var(--pool-light)", borderRadius: 99, padding: "6px 14px",
                fontSize: 13, fontWeight: 700, color: "var(--pool-blue)",
                border: "none", cursor: "pointer", fontFamily: "var(--font)",
              }}
            >+ Nueva</button>
          </div>
          <Card padding="0">
            {!todaySlots || !classes ? (
              Array.from({ length: 4 }).map((_, i) => (
                <div key={i} style={{ height: 80, borderRadius: 16, background: "var(--surface-2)" }} />
              ))
            ) : todaySlots.length === 0 ? (
              <div style={{ padding: 24, textAlign: "center", color: "var(--text-secondary)", fontSize: 14 }}>
                No hay clases programadas hoy.
              </div>
            ) : (
              todaySlots.map((slot, idx) => {
                const slotClass = classes.find((cls) => slot.modalities.includes(cls.key));

                return (
                  <div key={slot._id}>
                    {idx > 0 && <div style={{ height: 1, background: "var(--border)", margin: "0 16px" }} />}
                    <button
                      type="button"
                      onClick={() => slotClass && setEditing({
                        ...slotClass,
                        startTime: slot.startTime,
                        endTime: addOneHour(slot.startTime),
                      })}
                      disabled={!slotClass}
                      style={{
                        width: "100%",
                        padding: "14px 16px",
                        display: "flex",
                        alignItems: "center",
                        justifyContent: "space-between",
                        gap: 14,
                        background: "transparent",
                        border: "none",
                        cursor: slotClass ? "pointer" : "default",
                        fontFamily: "var(--font)",
                        textAlign: "left",
                      }}
                    >
                      <div style={{ minWidth: 0 }}>
                        <div style={{ fontSize: 14, fontWeight: 700, color: "var(--text-primary)", overflow: "hidden", textOverflow: "ellipsis", whiteSpace: "nowrap" }}>{slot.label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                          {slot.startTime} – {slot.endTime}
                        </div>
                      </div>
                      <span style={{ color: "var(--text-secondary)", fontSize: 16, flexShrink: 0 }}>›</span>
                    </button>
                  </div>
                );
              })
            )}
          </Card>
        </div>

        {/* Alert settings */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Alertas</div>
          <Card padding="0">
            <div style={{ padding: "14px 16px" }}>
              {editingAlert ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Input label="Días de alerta antes de vencer" value={editAlertValue} onChange={e => setEditAlertValue(e.target.value)} type="number" />
                  </div>
                  <Button variant="brand" size="sm" onClick={saveAlert} loading={saving}>✓</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditingAlert(false)}>✕</Button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={startAlertEdit}>
                  <div>
                    <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>Alertar días antes de vencer</div>
                    <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>Muestra alerta en el dashboard</div>
                  </div>
                  <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                    <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pool-blue)" }}>{config?.alert_days_before_due ?? 7} días</span>
                    <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>✏️</span>
                  </div>
                </div>
              )}
            </div>
          </Card>
        </div>

        {/* Info */}
        <div style={{ textAlign: "center", padding: "8px 0 20px" }}>
          <div style={{ fontSize: 12, color: "var(--text-secondary)" }}>Mística App • Gestión de clases de natación</div>
          <div style={{ fontSize: 11, color: "var(--text-disabled, rgba(26,26,46,0.28))", marginTop: 4 }}>Todos los datos se sincronizan en tiempo real</div>
        </div>
      </div>

      {editing && (
        <ClassForm
          isNew={editing === "new"}
          initial={editing === "new" ? EMPTY_FORM : {
            key: editing.key,
            name: editing.name,
            description: editing.description,
            price: String(editing.price),
            isActive: editing.isActive,
            days: editing.days,
            startTime: editing.startTime,
            endTime: editing.endTime,
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

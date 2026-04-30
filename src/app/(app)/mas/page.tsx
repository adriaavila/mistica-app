"use client";
import { useState } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import Link from "next/link";
import Card from "@/components/ui/Card";
import Button from "@/components/ui/Button";
import Input from "@/components/ui/Input";
import { formatCurrency } from "@/lib/utils";

interface PriceField { key: string; label: string; description: string; }

const PRICE_FIELDS: PriceField[] = [
  { key: "price_enrollment", label: "Inscripción", description: "Pago único al inscribirse" },
  { key: "price_lmv", label: "Natación LMV", description: "Mensualidad Lun-Mié-Vie" },
  { key: "price_mj", label: "Natación MJ", description: "Mensualidad Mar-Jue" },
  { key: "price_aquagym3x", label: "Aqua Gym 3x", description: "Mensualidad 3 veces/semana" },
  { key: "price_aquagym5x", label: "Aqua Gym 5x", description: "Mensualidad 5 veces/semana" },
  { key: "price_nat5x", label: "Natación 5 días", description: "Mensualidad 5 días/semana" },
];

export default function MasPage() {
  const config = useQuery(api.appConfig.getAll);
  const setConfig = useMutation(api.appConfig.set);
  const [editing, setEditing] = useState<string | null>(null);
  const [editValue, setEditValue] = useState("");
  const [saving, setSaving] = useState(false);

  const startEdit = (key: string) => {
    setEditing(key);
    setEditValue(config?.[key] ?? "");
  };

  const saveEdit = async () => {
    if (!editing) return;
    setSaving(true);
    await setConfig({ key: editing, value: editValue });
    setSaving(false);
    setEditing(null);
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

        {/* Pricing */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Precios ({config?.currency ?? "Bs"})</div>
          <Card padding="0">
            {PRICE_FIELDS.map((field, idx) => (
              <div key={field.key}>
                {idx > 0 && <div style={{ height: 1, background: "var(--border)", margin: "0 16px" }} />}
                <div style={{ padding: "14px 16px" }}>
                  {editing === field.key ? (
                    <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                      <div style={{ flex: 1 }}>
                        <Input label={field.label} value={editValue} onChange={e => setEditValue(e.target.value)} type="number" />
                      </div>
                      <Button variant="brand" size="sm" onClick={saveEdit} loading={saving}>✓</Button>
                      <Button variant="outline" size="sm" onClick={() => setEditing(null)}>✕</Button>
                    </div>
                  ) : (
                    <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between" }} onClick={() => startEdit(field.key)}>
                      <div>
                        <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>{field.label}</div>
                        <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>{field.description}</div>
                      </div>
                      <div style={{ display: "flex", alignItems: "center", gap: 10 }}>
                        <span style={{ fontSize: 15, fontWeight: 700, color: "var(--pool-blue)" }}>
                          {config ? formatCurrency(parseFloat(config[field.key] ?? "0"), config.currency ?? "Bs") : "—"}
                        </span>
                        <span style={{ fontSize: 14, color: "var(--text-secondary)" }}>✏️</span>
                      </div>
                    </div>
                  )}
                </div>
              </div>
            ))}
          </Card>
        </div>

        {/* Alert settings */}
        <div>
          <div style={{ fontSize: 16, fontWeight: 700, color: "var(--text-primary)", marginBottom: 12 }}>Alertas</div>
          <Card padding="0">
            <div style={{ padding: "14px 16px" }}>
              {editing === "alert_days_before_due" ? (
                <div style={{ display: "flex", gap: 10, alignItems: "flex-end" }}>
                  <div style={{ flex: 1 }}>
                    <Input label="Días de alerta antes de vencer" value={editValue} onChange={e => setEditValue(e.target.value)} type="number" />
                  </div>
                  <Button variant="brand" size="sm" onClick={saveEdit} loading={saving}>✓</Button>
                  <Button variant="outline" size="sm" onClick={() => setEditing(null)}>✕</Button>
                </div>
              ) : (
                <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", cursor: "pointer" }} onClick={() => startEdit("alert_days_before_due")}>
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
    </div>
  );
}

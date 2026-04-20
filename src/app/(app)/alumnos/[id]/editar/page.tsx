"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { MODALITY_LABELS } from "@/lib/utils";
import { Id } from "../../../../../../convex/_generated/dataModel";

export default function EditarAlumnoPage() {
  const { id } = useParams();
  const router = useRouter();
  const student = useQuery(api.students.get, { id: id as Id<"students"> });
  const timeSlots = useQuery(api.timeSlots.list, { activeOnly: true });
  const update = useMutation(api.students.update);

  const [form, setForm] = useState({ name: "", phone: "", dob: "", enrollmentDate: "", modality: "lmv", timeSlotId: "", status: "active", notes: "" });
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);

  useEffect(() => {
    if (student && !ready) {
      setForm({ name: student.name, phone: student.phone, dob: student.dob ?? "", enrollmentDate: student.enrollmentDate, modality: student.modality, timeSlotId: student.timeSlotId, status: student.status, notes: student.notes ?? "" });
      setReady(true);
    }
  }, [student, ready]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));
  const filteredSlots = timeSlots?.filter(s => s.modalities.includes(form.modality)) ?? [];

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await update({ id: id as Id<"students">, name: form.name, phone: form.phone, dob: form.dob || undefined, enrollmentDate: form.enrollmentDate, modality: form.modality as "lmv"|"mj"|"aquagym3x"|"aquagym5x", timeSlotId: form.timeSlotId as Id<"timeSlots">, status: form.status as "active"|"suspended"|"withdrawn", notes: form.notes || undefined });
      router.push(`/alumnos/${id}`);
    } catch { setLoading(false); }
  };

  if (!ready) return <div style={{ padding: 40, textAlign: "center", color: "var(--text-secondary)", fontFamily: "var(--font)" }}>Cargando...</div>;

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      <PageHeader title="Editar alumno" back />
      <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Nombre completo" value={form.name} onChange={e => set("name", e.target.value)} />
        <Input label="Teléfono" value={form.phone} onChange={e => set("phone", e.target.value)} type="tel" />
        <Input label="Fecha de nacimiento" value={form.dob} onChange={e => set("dob", e.target.value)} type="date" />
        <Input label="Fecha de inscripción" value={form.enrollmentDate} onChange={e => set("enrollmentDate", e.target.value)} type="date" />
        <Select label="Modalidad" value={form.modality} onChange={e => { set("modality", e.target.value); set("timeSlotId", student?.timeSlotId ?? ""); }} options={Object.entries(MODALITY_LABELS).map(([v,l]) => ({ value: v, label: l }))} />
        <Select label="Horario" value={form.timeSlotId} onChange={e => set("timeSlotId", e.target.value)} options={[{ value: "", label: "Seleccionar..." }, ...filteredSlots.map(s => ({ value: s._id, label: s.label }))]} />
        <Select label="Estado" value={form.status} onChange={e => set("status", e.target.value)} options={[{ value: "active", label: "Activo" }, { value: "suspended", label: "Suspendido" }, { value: "withdrawn", label: "Retirado" }]} />
        <Input label="Notas" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observaciones..." />
        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <Button type="submit" variant="brand" size="lg" fullWidth loading={loading}>Guardar cambios</Button>
          <Button type="button" variant="outline" size="lg" fullWidth onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { MODALITY_LABELS, todayStr } from "@/lib/utils";
import { Id } from "../../../../../convex/_generated/dataModel";

export default function NuevoAlumnoPage() {
  const router = useRouter();
  const create = useMutation(api.students.create);
  const timeSlots = useQuery(api.timeSlots.list, { activeOnly: true });

  const [form, setForm] = useState({
    name: "", phone: "", dob: "", enrollmentDate: todayStr(),
    modality: "lmv", timeSlotId: "", status: "active", notes: "",
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

  const filteredSlots = timeSlots?.filter(s => s.modalities.includes(form.modality)) ?? [];

  const modalityOptions = Object.entries(MODALITY_LABELS).map(([v, l]) => ({ value: v, label: l }));
  const slotOptions = filteredSlots.map(s => ({ value: s._id, label: s.label }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nombre requerido";
    if (!form.phone.trim()) e.phone = "Teléfono requerido";
    if (!form.timeSlotId) e.timeSlotId = "Selecciona un horario";
    return e;
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    const errs = validate();
    if (Object.keys(errs).length > 0) { setErrors(errs); return; }
    setLoading(true);
    try {
      await create({
        name: form.name.trim(),
        phone: form.phone.trim(),
        dob: form.dob || undefined,
        enrollmentDate: form.enrollmentDate,
        modality: form.modality as "lmv" | "mj" | "aquagym3x" | "aquagym5x",
        timeSlotId: form.timeSlotId as Id<"timeSlots">,
        status: form.status as "active" | "suspended" | "withdrawn",
        notes: form.notes || undefined,
      });
      router.push("/alumnos");
    } catch {
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      <PageHeader title="Nuevo alumno" back />
      <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Nombre completo" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej. María García" error={errors.name} />
        <Input label="Teléfono" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Ej. 0412-1234567" type="tel" error={errors.phone} />
        <Input label="Fecha de nacimiento (opcional)" value={form.dob} onChange={e => set("dob", e.target.value)} type="date" />
        <Input label="Fecha de inscripción" value={form.enrollmentDate} onChange={e => set("enrollmentDate", e.target.value)} type="date" />
        <Select label="Modalidad" value={form.modality} onChange={e => { set("modality", e.target.value); set("timeSlotId", ""); }} options={modalityOptions} />
        <Select label="Horario" value={form.timeSlotId} onChange={e => set("timeSlotId", e.target.value)} options={[{ value: "", label: "Seleccionar horario..." }, ...slotOptions]} error={errors.timeSlotId} />
        <Select label="Estado" value={form.status} onChange={e => set("status", e.target.value)} options={[{ value: "active", label: "Activo" }, { value: "suspended", label: "Suspendido" }, { value: "withdrawn", label: "Retirado" }]} />
        <Input label="Notas (opcional)" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observaciones..." />

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <Button type="submit" variant="brand" size="lg" fullWidth loading={loading}>Inscribir alumno</Button>
          <Button type="button" variant="outline" size="lg" fullWidth onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

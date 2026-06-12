"use client";
import { useState } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../convex/_generated/api";
import { useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { todayStr } from "@/lib/utils";
import { readStudentPhoto } from "@/lib/studentPhoto";
import { Id } from "../../../../../convex/_generated/dataModel";

const DUPLICATE_NAME_MESSAGE = "Ya existe un alumno con ese nombre.";

export default function NuevoAlumnoPage() {
  const router = useRouter();
  const create = useMutation(api.students.create);
  const timeSlots = useQuery(api.timeSlots.list, { activeOnly: true });
  const classes = useQuery(api.classes.list, { activeOnly: true });

  const [form, setForm] = useState({
    name: "", phone: "", photo: "", dob: "", enrollmentDate: todayStr(),
    modality: "", timeSlotId: "", secondTimeSlotId: "", status: "active", notes: "",
    chargeEnrollment: true,
  });
  const [loading, setLoading] = useState(false);
  const [errors, setErrors] = useState<Record<string, string>>({});
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  const set = (k: string, v: string | boolean) => {
    if (k === "name" && errors.name) setErrors(e => ({ ...e, name: "" }));
    setForm(f => ({ ...f, [k]: v }));
  };

  const handlePhotoChange = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    try {
      const photo = await readStudentPhoto(file);
      setPhotoPreview(photo);
      setForm(f => ({ ...f, photo }));
    } catch (err) {
      alert(err instanceof Error ? err.message : "No se pudo procesar la foto");
    }
  };

  const removePhoto = () => {
    setPhotoPreview(null);
    setForm(f => ({ ...f, photo: "" }));
  };

  const filteredSlots = timeSlots?.filter(s =>
    form.modality === "nat5x"
      ? s.modalities.includes("lmv")
      : s.modalities.includes(form.modality)
  ) ?? [];
  const mjSlots = form.modality === "nat5x"
    ? (timeSlots?.filter(s => s.modalities.includes("mj")) ?? [])
    : [];

  const modalityOptions = classes?.map(c => ({ value: c.key, label: c.name })) ?? [];
  const slotOptions = filteredSlots.map(s => ({ value: s._id, label: s.label }));
  const mjSlotOptions = mjSlots.map(s => ({ value: s._id, label: s.label }));

  const validate = () => {
    const e: Record<string, string> = {};
    if (!form.name.trim()) e.name = "Nombre requerido";
    if (!form.phone.trim()) e.phone = "Teléfono requerido";
    if (!form.modality) e.modality = "Selecciona una modalidad";
    if (!form.timeSlotId) e.timeSlotId = "Selecciona un horario";
    if (form.modality === "nat5x" && !form.secondTimeSlotId) e.secondTimeSlotId = "Selecciona un horario MJ";
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
        photo: form.photo || undefined,
        dob: form.dob || undefined,
        enrollmentDate: form.enrollmentDate,
        modality: form.modality,
        timeSlotId: form.timeSlotId as Id<"timeSlots">,
        secondTimeSlotId: form.modality === "nat5x" && form.secondTimeSlotId
          ? form.secondTimeSlotId as Id<"timeSlots">
          : undefined,
        status: form.status as "active" | "suspended" | "withdrawn",
        notes: form.notes || undefined,
        chargeEnrollment: form.chargeEnrollment,
      });
      router.push("/alumnos");
    } catch (err) {
      if (err instanceof Error && err.message.includes("Ya existe un alumno")) {
        setErrors({ name: DUPLICATE_NAME_MESSAGE });
      }
      setLoading(false);
    }
  };

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      <PageHeader title="Nuevo alumno" back />
      <form onSubmit={handleSubmit} style={{ padding: "20px", display: "flex", flexDirection: "column", gap: 16 }}>
        <Input label="Nombre completo" value={form.name} onChange={e => set("name", e.target.value)} placeholder="Ej. María García" error={errors.name} />
        <Input label="Teléfono" value={form.phone} onChange={e => set("phone", e.target.value)} placeholder="Ej. 0412-1234567" type="tel" error={errors.phone} />

        {/* Photo */}
        <div>
          <label style={{ fontSize: 13, fontWeight: 600, color: "var(--text-secondary)", display: "block", marginBottom: 8 }}>Foto del alumno</label>
          {photoPreview ? (
            <div style={{ display: "flex", alignItems: "center", gap: 12 }}>
              <img src={photoPreview} alt="Preview" style={{ width: 64, height: 64, borderRadius: "50%", objectFit: "cover", border: "1.5px solid var(--border)" }} />
              <button type="button" onClick={removePhoto} style={{ fontSize: 12, color: "var(--overdue-coral)", background: "none", border: "none", cursor: "pointer", fontWeight: 600 }}>Quitar foto</button>
            </div>
          ) : (
            <label style={{
              display: "flex", alignItems: "center", gap: 8,
              padding: "12px 14px", borderRadius: 12, border: "1.5px dashed var(--border)",
              cursor: "pointer", fontSize: 14, color: "var(--text-secondary)",
              fontFamily: "var(--font)", background: "var(--surface)",
            }}>
              <span style={{ fontSize: 20 }}>📷</span>
              <span>Seleccionar foto</span>
              <input type="file" accept="image/*" onChange={handlePhotoChange} style={{ display: "none" }} />
            </label>
          )}
        </div>

        <Input label="Fecha de nacimiento (opcional)" value={form.dob} onChange={e => set("dob", e.target.value)} type="date" />
        <Input label="Fecha de inscripción" value={form.enrollmentDate} onChange={e => set("enrollmentDate", e.target.value)} type="date" />
        <Select label="Modalidad" value={form.modality} onChange={e => { set("modality", e.target.value); set("timeSlotId", ""); set("secondTimeSlotId", ""); }} options={[{ value: "", label: "Seleccionar modalidad..." }, ...modalityOptions]} error={errors.modality} />
        <Select label={form.modality === "nat5x" ? "Horario LMV (Lun/Mié/Vie)" : "Horario"} value={form.timeSlotId} onChange={e => set("timeSlotId", e.target.value)} options={[{ value: "", label: "Seleccionar horario..." }, ...slotOptions]} error={errors.timeSlotId} />
        {form.modality === "nat5x" && (
          <Select label="Horario MJ (Mar/Jue)" value={form.secondTimeSlotId} onChange={e => set("secondTimeSlotId", e.target.value)} options={[{ value: "", label: "Seleccionar horario MJ..." }, ...mjSlotOptions]} error={errors.secondTimeSlotId} />
        )}
        <Select label="Estado" value={form.status} onChange={e => set("status", e.target.value)} options={[{ value: "active", label: "Activo" }, { value: "suspended", label: "Suspendido" }, { value: "withdrawn", label: "Retirado" }]} />
        <Input label="Notas (opcional)" value={form.notes} onChange={e => set("notes", e.target.value)} placeholder="Observaciones..." />

        <label style={{ display: "flex", alignItems: "center", gap: 10, fontSize: 14, fontWeight: 600, color: "var(--text-primary)", cursor: "pointer", marginTop: 4 }}>
          <input
            type="checkbox"
            checked={form.chargeEnrollment}
            onChange={e => set("chargeEnrollment", e.target.checked)}
            style={{ width: 18, height: 18, cursor: "pointer", accentColor: "var(--pool-blue)" }}
          />
          Cobrar inscripción (60 Bs)
        </label>

        <div style={{ marginTop: 8, display: "flex", flexDirection: "column", gap: 10 }}>
          <Button type="submit" variant="brand" size="lg" fullWidth loading={loading}>Inscribir alumno</Button>
          <Button type="button" variant="outline" size="lg" fullWidth onClick={() => router.back()}>Cancelar</Button>
        </div>
      </form>
    </div>
  );
}

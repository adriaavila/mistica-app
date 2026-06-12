"use client";
import { useState, useEffect } from "react";
import { useMutation, useQuery } from "convex/react";
import { api } from "../../../../../../convex/_generated/api";
import { useParams, useRouter } from "next/navigation";
import PageHeader from "@/components/ui/PageHeader";
import Input from "@/components/ui/Input";
import Select from "@/components/ui/Select";
import Button from "@/components/ui/Button";
import { readStudentPhoto } from "@/lib/studentPhoto";
import { Id } from "../../../../../../convex/_generated/dataModel";

export default function EditarAlumnoPage() {
  const { id } = useParams();
  const router = useRouter();
  const student = useQuery(api.students.get, { id: id as Id<"students"> });
  const timeSlots = useQuery(api.timeSlots.list, { activeOnly: true });
  const classes = useQuery(api.classes.list, { activeOnly: true });
  const update = useMutation(api.students.update);

  const [form, setForm] = useState({ name: "", phone: "", photo: "", dob: "", enrollmentDate: "", modality: "", timeSlotId: "", secondTimeSlotId: "", status: "active", notes: "" });
  const [loading, setLoading] = useState(false);
  const [ready, setReady] = useState(false);
  const [photoPreview, setPhotoPreview] = useState<string | null>(null);

  useEffect(() => {
    if (student && !ready) {
      setForm({ name: student.name, phone: student.phone, photo: student.photo ?? "", dob: student.dob ?? "", enrollmentDate: student.enrollmentDate, modality: student.modality, timeSlotId: student.timeSlotId, secondTimeSlotId: student.secondTimeSlotId ?? "", status: student.status, notes: student.notes ?? "" });
      setPhotoPreview(student.photo ?? null);
      setReady(true);
    }
  }, [student, ready]);

  const set = (k: string, v: string) => setForm(f => ({ ...f, [k]: v }));

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

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setLoading(true);
    try {
      await update({
        id: id as Id<"students">,
        name: form.name,
        phone: form.phone,
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
      });
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

        <Input label="Fecha de nacimiento" value={form.dob} onChange={e => set("dob", e.target.value)} type="date" />
        <Input label="Fecha de inscripción" value={form.enrollmentDate} onChange={e => set("enrollmentDate", e.target.value)} type="date" />
        <Select label="Modalidad" value={form.modality} onChange={e => { set("modality", e.target.value); set("timeSlotId", ""); set("secondTimeSlotId", ""); }} options={[{ value: "", label: "Seleccionar..." }, ...modalityOptions]} />
        <Select label={form.modality === "nat5x" ? "Horario LMV (Lun/Mié/Vie)" : "Horario"} value={form.timeSlotId} onChange={e => set("timeSlotId", e.target.value)} options={[{ value: "", label: "Seleccionar..." }, ...filteredSlots.map(s => ({ value: s._id, label: s.label }))]} />
        {form.modality === "nat5x" && (
          <Select label="Horario MJ (Mar/Jue)" value={form.secondTimeSlotId} onChange={e => set("secondTimeSlotId", e.target.value)} options={[{ value: "", label: "Seleccionar horario MJ..." }, ...mjSlots.map(s => ({ value: s._id, label: s.label }))]} />
        )}
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

"use client";
import { useEffect, useMemo, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import { todayStr, formatDate, getRelativeDays, MODALITY_SHORT, MODALITY_COLORS } from "@/lib/utils";
import { Id } from "../../../../convex/_generated/dataModel";

// Pick the best slot for today based on current clock time
function getAutoSlotId(
  slots: Array<{ _id: string; days: string[]; startTime: string; endTime: string }>,
  date: string
): string | null {
  const dateDay = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
  });
  const daySlots = slots
    .filter((s) => s.days.includes(dateDay))
    .sort((a, b) => a.startTime.localeCompare(b.startTime));

  if (daySlots.length === 0) return null;

  const isToday = date === todayStr();
  if (!isToday) return daySlots[0]._id;

  const now = new Date();
  const cur = `${String(now.getHours()).padStart(2, "0")}:${String(now.getMinutes()).padStart(2, "0")}`;

  // Currently active window
  const active = daySlots.find((s) => cur >= s.startTime && cur < s.endTime);
  if (active) return active._id;

  // Next upcoming class
  const upcoming = daySlots.find((s) => s.startTime > cur);
  if (upcoming) return upcoming._id;

  // All classes done for today → last slot
  return daySlots[daySlots.length - 1]._id;
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────
function AsistenciaContent() {
  const router = useRouter();
  const pathname = usePathname();
  const searchParams = useSearchParams();
  const date = searchParams.get("date") ?? todayStr();
  // null = auto-select; string = user picked explicitly
  const selectedSlotId = searchParams.get("slotId");

  const setScheduleParams = (nextDate: string, nextSlotId?: string | null) => {
    const params = new URLSearchParams(searchParams);
    params.set("date", nextDate);
    if (nextSlotId) params.set("slotId", nextSlotId);
    else params.delete("slotId");
    router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  };

  const slots = useQuery(api.timeSlots.list, { activeOnly: true });
  const upsertAttendance = useMutation(api.attendance.upsert);

  const dateDay = new Date(date + "T12:00:00").toLocaleDateString("en-US", {
    weekday: "short",
  });
  const daySlots = useMemo(
    () =>
      (slots ?? [])
        .filter((s) => s.days.includes(dateDay))
        .sort((a, b) => a.startTime.localeCompare(b.startTime)),
    [slots, dateDay]
  );

  // Active slot: explicit selection wins, otherwise auto-pick by time
  const activeSlotId = useMemo(() => {
    if (selectedSlotId) return selectedSlotId;
    if (!slots) return null;
    return getAutoSlotId(slots, date);
  }, [selectedSlotId, slots, date]);

  useEffect(() => {
    if (!activeSlotId) return;
    const params = new URLSearchParams(searchParams);
    let changed = false;
    if (params.get("date") !== date) {
      params.set("date", date);
      changed = true;
    }
    if (!selectedSlotId) {
      params.set("slotId", activeSlotId);
      changed = true;
    }
    if (changed) router.replace(`${pathname}?${params.toString()}`, { scroll: false });
  }, [activeSlotId, date, pathname, router, searchParams, selectedSlotId]);

  const studentsData = useQuery(
    api.attendance.getStudentsForSlot,
    activeSlotId
      ? { timeSlotId: activeSlotId as Id<"timeSlots">, date }
      : "skip"
  );

  const presentCount = studentsData?.filter((s) => s.attendance?.present).length ?? 0;
  const totalCount = studentsData?.length ?? 0;

  const toggle = async (studentId: Id<"students">, currentPresent: boolean | null) => {
    if (!activeSlotId) return;
    await upsertAttendance({
      studentId,
      timeSlotId: activeSlotId as Id<"timeSlots">,
      date,
      present: currentPresent !== true,
    });
  };

  // Label for active slot in header
  const activeSlot = daySlots.find((s) => s._id === activeSlotId);

  return (
    <div style={{ fontFamily: "var(--font)" }}>
      {/* Header */}
      <div style={{
        padding: "20px 20px 12px", background: "var(--white)",
        borderBottom: "1px solid var(--border)", position: "sticky", top: 0, zIndex: 10,
      }}>
        <div style={{ display: "flex", alignItems: "center", justifyContent: "space-between", marginBottom: 12 }}>
          <div>
            <div style={{ fontSize: 22, fontWeight: 800, color: "var(--text-primary)" }}>Asistencia</div>
            {activeSlot && (
              <div style={{ fontSize: 12, color: "var(--text-secondary)", marginTop: 2 }}>
                {activeSlot.label} · {activeSlot.startTime}–{activeSlot.endTime}
              </div>
            )}
          </div>
          {activeSlotId && studentsData && (
            <div style={{
              background: presentCount === totalCount && totalCount > 0 ? "var(--paid-light)" : "var(--pool-light)",
              borderRadius: 99, padding: "6px 14px",
              fontSize: 14, fontWeight: 800,
              color: presentCount === totalCount && totalCount > 0 ? "var(--paid-green)" : "var(--pool-blue)",
            }}>
              {presentCount}/{totalCount}
            </div>
          )}
        </div>

        {/* Date picker */}
        <input
          type="date"
          aria-label="Fecha de asistencia"
          name="date"
          value={date}
          onChange={(e) => {
            setScheduleParams(e.target.value, null);
          }}
          onFocus={e => { e.currentTarget.style.borderColor = "var(--pool-blue)"; e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
          onBlur={e => { e.currentTarget.style.borderColor = "var(--border)"; e.currentTarget.style.boxShadow = "none"; }}
          style={{
            height: 40, borderRadius: 10, border: "1.5px solid var(--border)",
            background: "var(--surface)", padding: "0 12px",
            fontFamily: "var(--font)", fontSize: 14, outline: "none",
            color: "var(--text-primary)", marginBottom: 12, width: "100%",
            transition: "border-color 0.15s ease, box-shadow 0.15s ease",
          }}
        />

        {/* Slot tabs */}
        {daySlots.length > 0 && (
          <div style={{
            display: "flex", gap: 8, overflowX: "auto",
            paddingBottom: 4, scrollbarWidth: "none",
            msOverflowStyle: "none",
          }}>
            {daySlots.map((slot) => {
              const isActive = slot._id === activeSlotId;
              return (
                <button
                  type="button"
                  key={slot._id}
                  aria-pressed={isActive}
                  onClick={() => setScheduleParams(date, slot._id)}
                  style={{
                    fontFamily: "var(--font)", fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--white)" : "var(--text-secondary)",
                    background: isActive ? "var(--pool-blue)" : "var(--surface-2)",
                    border: "none", borderRadius: 99, padding: "8px 16px",
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
                  }}
                  onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  {slot.label}
                </button>
              );
            })}
          </div>
        )}
      </div>

      {/* Student list */}
      <div style={{ padding: "12px 20px", display: "flex", flexDirection: "column", gap: 8 }}>
        {daySlots.length === 0 ? (
          <EmptyState emoji="📅" title="Sin clases" description="No hay horarios para este día" />
        ) : !studentsData ? (
          Array.from({ length: 8 }).map((_, i) => (
            <div key={i} style={{ height: 68, borderRadius: 14, background: "var(--surface-2)", opacity: 0.6 }} />
          ))
        ) : studentsData.length === 0 ? (
          <EmptyState emoji="👥" title="Sin alumnos" description="No hay alumnos activos en este horario" />
        ) : (
          studentsData.map((student) => {
            const isPresent = student.attendance?.present === true;
            const isAbsent = student.attendance?.present === false;
            return (
              <div
                key={student._id}
                style={{
                  background: "var(--white)", borderRadius: 14, padding: "12px 14px",
                  boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 12,
                }}
              >
                <Avatar name={student.name} size={40} src={student.photo} />

                {/* Name — tappable to open the student profile */}
                <button
                  type="button"
                  aria-label={`Ver perfil de ${student.name}`}
                  style={{ flex: 1, minWidth: 0, cursor: "pointer", background: "transparent", border: "none", padding: 0, textAlign: "left", fontFamily: "var(--font)", borderRadius: 10 }}
                  onClick={() => router.push(`/alumnos/${student._id}`)}
                  onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  <span style={{
                    fontSize: 15,
                    fontWeight: 700,
                    color: student.status === "suspended" ? "var(--text-secondary)" : "var(--text-primary)",
                    display: "flex",
                    alignItems: "center",
                    gap: 6,
                    opacity: student.status === "suspended" ? 0.7 : 1,
                  }}>
                    {student.name}
                    {MODALITY_SHORT[student.modality] && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: MODALITY_COLORS[student.modality]?.color ?? "var(--text-secondary)",
                        background: MODALITY_COLORS[student.modality]?.bg ?? "var(--surface-2)",
                        borderRadius: 6,
                        padding: "2px 6px",
                      }}>
                        {MODALITY_SHORT[student.modality]}
                      </span>
                    )}
                    {student.status === "suspended" && (
                      <span style={{
                        fontSize: 10,
                        fontWeight: 700,
                        color: "var(--overdue-coral)",
                        background: "var(--overdue-light)",
                        borderRadius: 6,
                        padding: "2px 6px",
                      }}>
                        Suspendido
                      </span>
                    )}
                    <span style={{ fontSize: 11, color: "var(--pool-blue)", fontWeight: 600 }}>
                      ver perfil ›
                    </span>
                  </span>
                  <span style={{ display: "block", fontSize: 12, color: isPresent ? "var(--paid-green)" : isAbsent ? "var(--overdue-coral)" : "var(--text-secondary)", marginTop: 2, fontWeight: isPresent || isAbsent ? 600 : 400 }}>
                    {isPresent ? "✓ Presente" : isAbsent ? "✗ Ausente" : "Sin registrar"}
                  </span>
                  {student.nextDue && (() => {
                    const rel = getRelativeDays(student.nextDue.dueDate);
                    const isPaid = student.nextDue.status === "paid";
                    const palette = isPaid
                      ? { bg: "var(--paid-light)", fg: "var(--paid-green)" }
                      : rel.urgency === "overdue"
                      ? { bg: "var(--overdue-light)", fg: "var(--overdue-coral)" }
                      : rel.urgency === "soon"
                      ? { bg: "var(--pending-light, #FEF3C7)", fg: "var(--pending-amber, #B45309)" }
                      : { bg: "var(--surface-2)", fg: "var(--text-secondary)" };
                    const dateStr = formatDate(student.nextDue.dueDate, { day: "numeric", month: "short" });
                    const label = isPaid
                      ? `Al día · próximo ${dateStr}`
                      : rel.urgency === "overdue"
                      ? `Venció ${dateStr}`
                      : `Vence ${dateStr}`;
                    return (
                      <span style={{
                        display: "inline-flex", alignItems: "center", gap: 4,
                        marginTop: 4, padding: "2px 8px", borderRadius: 99,
                        background: palette.bg, color: palette.fg,
                        fontSize: 11, fontWeight: 700,
                      }}>
                        💳 {label}
                      </span>
                    );
                  })()}
                </button>

                {/* Toggle button */}
                <button
                  type="button"
                  aria-label={`${isPresent ? "Marcar ausente" : "Marcar presente"} a ${student.name}`}
                  onClick={() =>
                    toggle(student._id as Id<"students">, student.attendance?.present ?? null)
                  }
                  style={{
                    width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: isPresent ? "var(--paid-green)" : isAbsent ? "var(--overdue-light)" : "var(--surface-2)",
                    color: isPresent ? "#fff" : isAbsent ? "var(--overdue-coral)" : "var(--text-secondary)",
                    fontSize: 20, fontWeight: 700, transition: "background-color 0.15s ease, color 0.15s ease, box-shadow 0.15s ease",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                  onFocus={e => { e.currentTarget.style.boxShadow = "var(--shadow-focus)"; }}
                  onBlur={e => { e.currentTarget.style.boxShadow = "none"; }}
                >
                  {isPresent ? "✓" : isAbsent ? "✗" : "·"}
                </button>
              </div>
            );
          })
        )}
      </div>

    </div>
  );
}

export default function AsistenciaPage() {
  return (
    <Suspense>
      <AsistenciaContent />
    </Suspense>
  );
}

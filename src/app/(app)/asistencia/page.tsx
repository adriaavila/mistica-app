"use client";
import { useState, useMemo, Suspense } from "react";
import { useQuery, useMutation } from "convex/react";
import { api } from "../../../../convex/_generated/api";
import { useSearchParams } from "next/navigation";
import Avatar from "@/components/ui/Avatar";
import EmptyState from "@/components/ui/EmptyState";
import BottomSheet from "@/components/ui/BottomSheet";
import { todayStr, formatDate } from "@/lib/utils";
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
// History sheet for a single student
// ──────────────────────────────────────────────────────────────────────────────
function StudentHistorySheet({
  studentId,
  studentName,
  onClose,
}: {
  studentId: Id<"students">;
  studentName: string;
  onClose: () => void;
}) {
  const records = useQuery(api.attendance.listByStudent, { studentId });

  const grouped = useMemo(() => {
    if (!records) return [];
    const map = new Map<string, typeof records>();
    for (const r of records) {
      const month = r.date.substring(0, 7);
      if (!map.has(month)) map.set(month, []);
      map.get(month)!.push(r);
    }
    return Array.from(map.entries()).sort((a, b) => b[0].localeCompare(a[0]));
  }, [records]);

  const totalPresent = records?.filter((r) => r.present).length ?? 0;
  const totalAbsent = records?.filter((r) => !r.present).length ?? 0;
  const rate =
    records && records.length > 0
      ? Math.round((totalPresent / records.length) * 100)
      : null;

  const MONTH_ES = [
    "Enero","Febrero","Marzo","Abril","Mayo","Junio",
    "Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre",
  ];
  const formatMonth = (m: string) => {
    const [y, mo] = m.split("-");
    return `${MONTH_ES[parseInt(mo) - 1]} ${y}`;
  };

  return (
    <BottomSheet open onClose={onClose} title={`Historial · ${studentName}`}>
      {/* Summary bar */}
      {rate !== null && (
        <div style={{ marginBottom: 20 }}>
          <div style={{ display: "flex", justifyContent: "space-between", marginBottom: 8 }}>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--paid-green)" }}>{totalPresent}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>PRESENTES</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--overdue-coral)" }}>{totalAbsent}</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>AUSENTES</div>
            </div>
            <div style={{ textAlign: "center" }}>
              <div style={{ fontSize: 24, fontWeight: 800, color: "var(--pool-blue)" }}>{rate}%</div>
              <div style={{ fontSize: 11, color: "var(--text-secondary)", fontWeight: 600 }}>ASISTENCIA</div>
            </div>
          </div>
          {/* Progress bar */}
          <div style={{ height: 8, background: "var(--surface-2)", borderRadius: 99, overflow: "hidden" }}>
            <div style={{
              height: "100%", width: `${rate}%`, borderRadius: 99,
              background: rate >= 70 ? "var(--paid-green)" : rate >= 50 ? "var(--pending-amber)" : "var(--overdue-coral)",
              transition: "width 0.4s ease",
            }} />
          </div>
        </div>
      )}

      {/* Records grouped by month */}
      {!records ? (
        <div style={{ textAlign: "center", padding: "24px 0", color: "var(--text-secondary)", fontSize: 14 }}>
          Cargando...
        </div>
      ) : records.length === 0 ? (
        <div style={{ textAlign: "center", padding: "24px 0" }}>
          <div style={{ fontSize: 36, marginBottom: 8 }}>📅</div>
          <div style={{ fontSize: 14, color: "var(--text-secondary)" }}>Sin registros de asistencia aún</div>
        </div>
      ) : (
        <div style={{ display: "flex", flexDirection: "column", gap: 20 }}>
          {grouped.map(([month, monthRecords]) => (
            <div key={month}>
              <div style={{
                fontSize: 12, fontWeight: 700, color: "var(--text-secondary)",
                textTransform: "uppercase", letterSpacing: "0.06em",
                marginBottom: 10,
              }}>
                {formatMonth(month)}
              </div>
              <div style={{ display: "flex", flexDirection: "column", gap: 6 }}>
                {monthRecords.map((rec) => (
                  <div key={rec._id} style={{
                    display: "flex", alignItems: "center", gap: 12,
                    padding: "10px 14px",
                    background: rec.present ? "var(--paid-light)" : "var(--overdue-light)",
                    borderRadius: 12,
                  }}>
                    <span style={{
                      width: 28, height: 28, borderRadius: "50%",
                      background: rec.present ? "var(--paid-green)" : "var(--overdue-coral)",
                      color: "#fff", fontSize: 14, fontWeight: 700,
                      display: "flex", alignItems: "center", justifyContent: "center",
                      flexShrink: 0,
                    }}>
                      {rec.present ? "✓" : "✗"}
                    </span>
                    <div style={{ flex: 1 }}>
                      <div style={{ fontSize: 14, fontWeight: 600, color: "var(--text-primary)" }}>
                        {formatDate(rec.date, { weekday: "long", day: "numeric", month: "long" })}
                      </div>
                    </div>
                    <span style={{
                      fontSize: 12, fontWeight: 700,
                      color: rec.present ? "var(--paid-green)" : "var(--overdue-coral)",
                    }}>
                      {rec.present ? "Presente" : "Ausente"}
                    </span>
                  </div>
                ))}
              </div>
            </div>
          ))}
        </div>
      )}
    </BottomSheet>
  );
}

// ──────────────────────────────────────────────────────────────────────────────
// Main page
// ──────────────────────────────────────────────────────────────────────────────
function AsistenciaContent() {
  const searchParams = useSearchParams();
  const [date, setDate] = useState(searchParams.get("date") ?? todayStr());
  // null = auto-select; string = user picked explicitly
  const [selectedSlotId, setSelectedSlotId] = useState<string | null>(
    searchParams.get("slotId")
  );
  const [historyStudent, setHistoryStudent] = useState<{
    id: Id<"students">;
    name: string;
  } | null>(null);

  const slots = useQuery(api.timeSlots.list, { activeOnly: true });
  const upsertAttendance = useMutation(api.attendance.upsert);
  const overduePayments = useQuery(api.payments.listOverdue);
  const overdueStudentIds = useMemo(
    () => new Set((overduePayments ?? []).map(p => p.studentId)),
    [overduePayments]
  );

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
          value={date}
          onChange={(e) => {
            setDate(e.target.value);
            setSelectedSlotId(null); // reset to auto-select on date change
          }}
          style={{
            height: 40, borderRadius: 10, border: "1.5px solid var(--border)",
            background: "var(--surface)", padding: "0 12px",
            fontFamily: "var(--font)", fontSize: 14, outline: "none",
            color: "var(--text-primary)", marginBottom: 12, width: "100%",
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
                  key={slot._id}
                  onClick={() => setSelectedSlotId(slot._id)}
                  style={{
                    fontFamily: "var(--font)", fontSize: 13,
                    fontWeight: isActive ? 700 : 500,
                    color: isActive ? "var(--white)" : "var(--text-secondary)",
                    background: isActive ? "var(--pool-blue)" : "var(--surface-2)",
                    border: "none", borderRadius: 99, padding: "8px 16px",
                    cursor: "pointer", whiteSpace: "nowrap", flexShrink: 0,
                    transition: "all 0.15s ease",
                  }}
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
            const inMora = overdueStudentIds.has(student._id);
            return (
              <div
                key={student._id}
                style={{
                  background: "var(--white)", borderRadius: 14, padding: "12px 14px",
                  boxShadow: "var(--shadow-card)", display: "flex", alignItems: "center", gap: 12,
                  borderLeft: inMora ? "3px solid var(--overdue-coral)" : undefined,
                }}
              >
                <Avatar name={student.name} size={40} />

                {/* Name — tappable to open history */}
                <div
                  style={{ flex: 1, cursor: "pointer" }}
                  onClick={() =>
                    setHistoryStudent({ id: student._id as Id<"students">, name: student.name })
                  }
                >
                  <div style={{
                    fontSize: 15, fontWeight: 700, color: "var(--text-primary)",
                    display: "flex", alignItems: "center", gap: 6,
                  }}>
                    {student.name}
                    {inMora && (
                      <span style={{
                        fontSize: 10, fontWeight: 700, color: "var(--overdue-coral)",
                        background: "var(--overdue-light)", borderRadius: 99,
                        padding: "2px 7px", lineHeight: 1.4,
                      }}>mora</span>
                    )}
                  </div>
                  <div style={{ fontSize: 12, color: isPresent ? "var(--paid-green)" : isAbsent ? "var(--overdue-coral)" : "var(--text-secondary)", marginTop: 2, fontWeight: isPresent || isAbsent ? 600 : 400 }}>
                    {isPresent ? "✓ Presente" : isAbsent ? "✗ Ausente" : "Sin registrar"}
                  </div>
                </div>

                {/* Toggle button */}
                <button
                  onClick={() =>
                    toggle(student._id as Id<"students">, student.attendance?.present ?? null)
                  }
                  style={{
                    width: 48, height: 48, borderRadius: "50%", border: "none", cursor: "pointer",
                    background: isPresent ? "var(--paid-green)" : isAbsent ? "var(--overdue-light)" : "var(--surface-2)",
                    color: isPresent ? "#fff" : isAbsent ? "var(--overdue-coral)" : "var(--text-secondary)",
                    fontSize: 20, fontWeight: 700, transition: "all 0.15s ease",
                    display: "flex", alignItems: "center", justifyContent: "center",
                    flexShrink: 0,
                  }}
                >
                  {isPresent ? "✓" : isAbsent ? "✗" : "·"}
                </button>
              </div>
            );
          })
        )}
      </div>

      {/* History sheet */}
      {historyStudent && (
        <StudentHistorySheet
          studentId={historyStudent.id}
          studentName={historyStudent.name}
          onClose={() => setHistoryStudent(null)}
        />
      )}
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

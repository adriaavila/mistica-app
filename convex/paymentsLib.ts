import { MutationCtx } from "./_generated/server";
import { Doc, Id } from "./_generated/dataModel";

export function nextMonthOf(month: string): string {
  const [y, m] = month.split("-").map(Number);
  return m === 12 ? `${y + 1}-01` : `${y}-${String(m + 1).padStart(2, "0")}`;
}

// dueDate string for a given month anchored to the student's enrollment day,
// clamped to the month's last day (e.g. enroll day 31 → Feb 28).
export function dueDateForMonth(month: string, enrollmentDate: string): string {
  const [y, m] = month.split("-").map(Number);
  const enrollDay = new Date(enrollmentDate + "T00:00:00").getDate();
  const lastDay = new Date(y, m, 0).getDate();
  return `${month}-${String(Math.min(enrollDay, lastDay)).padStart(2, "0")}`;
}

// Creates the following monthly payment after `payment` was fully paid.
// The billing month advances from payment.month (not from dueDate): permits
// shift dueDate by days and, when that crosses a month boundary, deriving the
// month from dueDate skipped a month in the sequence.
export async function insertNextMonthlyPayment(ctx: MutationCtx, payment: Doc<"payments">) {
  const student = await ctx.db.get(payment.studentId);
  if (!student) return;
  const currentDue = new Date(payment.dueDate + "T00:00:00");
  const nextDue = new Date(currentDue.getFullYear(), currentDue.getMonth() + 1, 1);
  const enrollDay = new Date(student.enrollmentDate + "T00:00:00").getDate();
  const lastDay = new Date(nextDue.getFullYear(), nextDue.getMonth() + 1, 0).getDate();
  nextDue.setDate(Math.min(enrollDay, lastDay));
  const nextDueStr = `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}-${String(nextDue.getDate()).padStart(2, "0")}`;
  const nextMonthStr = payment.month
    ? nextMonthOf(payment.month)
    : `${nextDue.getFullYear()}-${String(nextDue.getMonth() + 1).padStart(2, "0")}`;
  const existing = await ctx.db
    .query("payments")
    .withIndex("by_student", (q) => q.eq("studentId", payment.studentId))
    .collect()
    .then((ps) => ps.find((p) => p.type === "monthly" && p.month === nextMonthStr));
  if (!existing) {
    await ctx.db.insert("payments", {
      studentId: payment.studentId,
      type: "monthly",
      amount: payment.amount,
      dueDate: nextDueStr,
      status: "pending",
      month: nextMonthStr,
    });
  }
}

// Ensures a reactivated student has a pending monthly payment going forward.
// Withdrawal deletes pending (non-overdue) months, so on reactivation we
// recreate the current month if the student has no unpaid monthly payment.
export async function ensureCurrentMonthPayment(ctx: MutationCtx, studentId: Id<"students">) {
  const student = await ctx.db.get(studentId);
  if (!student) return;

  const payments = await ctx.db
    .query("payments")
    .withIndex("by_student", (q) => q.eq("studentId", studentId))
    .collect();
  const monthly = payments.filter((p) => p.type === "monthly");

  const hasUnpaid = monthly.some((p) => p.status !== "paid");
  if (hasUnpaid) return;

  const now = new Date();
  const month = `${now.getFullYear()}-${String(now.getMonth() + 1).padStart(2, "0")}`;
  if (monthly.some((p) => p.month === month)) return;

  const cls = await ctx.db
    .query("classes")
    .withIndex("by_key", (q) => q.eq("key", student.modality))
    .first();
  const amount = cls?.price ?? monthly[monthly.length - 1]?.amount ?? 0;
  if (amount === 0) return;

  await ctx.db.insert("payments", {
    studentId,
    type: "monthly",
    amount,
    dueDate: dueDateForMonth(month, student.enrollmentDate),
    status: "pending",
    month,
  });
}

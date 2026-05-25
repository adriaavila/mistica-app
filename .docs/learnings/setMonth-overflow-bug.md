# Bug: `setMonth()` Day Overflow Skips a Month

## What happened

Students enrolled on month-end days (e.g. March 31) had their first payment land in the wrong month. A student enrolled March 31 should have their first due date in April, but instead got May.

## Root cause

JavaScript's `Date.setMonth()` does not clamp the day — it overflows:

```js
const d = new Date("2026-03-31T00:00:00");
d.setMonth(3); // April (0-indexed)
// April 31 doesn't exist → JS rolls over to May 1
console.log(d); // 2026-05-01 — WRONG
```

The next `setDate()` call then computes `lastDayOfNextMonth` relative to the already-overflowed date, so clamping fixes the day but not the month. The intended month is permanently skipped.

## Affected months (enrollment day → skipped month)

| Enroll day | Overflows from |
|---|---|
| Jan 31 | Feb (28/29 days) |
| March 31 | April (30 days) |
| May 31 | June (30 days) |
| July 31 | August (31 days — no overflow) |
| Aug 31 | September (30 days) |
| Oct 31 | November (30 days) |
| Dec 31 | January (31 days — no overflow) |

## Fix

Anchor to the 1st of the target month first, then set the day. This avoids overflow entirely:

```js
// WRONG — setMonth can overflow the day
const dueDate = new Date(enrollDate);
dueDate.setMonth(dueDate.getMonth() + 1);

// CORRECT — go to day 1 first, then set day (clamped to last day of month)
const nextMonthDate = new Date(enrollDate.getFullYear(), enrollDate.getMonth() + 1, 1);
const lastDay = new Date(nextMonthDate.getFullYear(), nextMonthDate.getMonth() + 1, 0).getDate();
nextMonthDate.setDate(Math.min(enrollDay, lastDay));
```

`payments.ts` (`markPaid`, `addPartialPayment`) already used the safe pattern. `students.ts` (initial payment creation on enrollment) did not — that's where the bug lived.

## File fixed

- `convex/students.ts` — initial monthly payment generation on student creation

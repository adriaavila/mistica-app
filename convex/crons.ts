import { cronJobs } from "convex/server";
import { internal } from "./_generated/api";

const crons = cronJobs();

// Flip past-due pending payments to overdue every morning (06:00 UTC ≈ 02:00 Bolivia).
crons.daily(
  "mark overdue payments",
  { hourUTC: 6, minuteUTC: 0 },
  internal.payments.markOverdueInternal
);

// Generate the current month's monthly payments for active students on the 1st.
crons.monthly(
  "generate monthly payments",
  { day: 1, hourUTC: 6, minuteUTC: 0 },
  internal.payments.generateCurrentMonthInternal
);

export default crons;

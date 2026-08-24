"use client";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function DataInitializer() {
  const seedConfig = useMutation(api.appConfig.seedDefaults);
  const seedClasses = useMutation(api.classes.seedDefaults);
  const seedSlots = useMutation(api.timeSlots.seedDefaultSlots);
  const seedStudents = useMutation(api.seed.seedStudents);
  const ensureClassSlots = useMutation(api.classes.ensureSlotsForClasses);

  useEffect(() => {
    seedConfig();
    seedStudents();
    // Order matters: the backfill must see the seeded classes and the default
    // slots, otherwise it creates duplicates or blocks seedDefaultSlots.
    (async () => {
      await seedClasses();
      await seedSlots();
      await ensureClassSlots();
    })();
  }, []);

  return null;
}

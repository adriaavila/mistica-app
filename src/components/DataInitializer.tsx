"use client";
import { useEffect } from "react";
import { useMutation } from "convex/react";
import { api } from "../../convex/_generated/api";

export default function DataInitializer() {
  const seedConfig = useMutation(api.appConfig.seedDefaults);
  const seedClasses = useMutation(api.classes.seedDefaults);
  const seedSlots = useMutation(api.timeSlots.seedDefaultSlots);
  const seedStudents = useMutation(api.seed.seedStudents);

  useEffect(() => {
    seedConfig();
    seedClasses();
    seedSlots();
    seedStudents();
  }, []);

  return null;
}

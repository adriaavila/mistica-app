import { mutation } from "./_generated/server";
import { Id } from "./_generated/dataModel";

export const markEnrollmentsPaid = mutation({
  args: {},
  handler: async (ctx) => {
    const payments = await ctx.db.query("payments").collect();
    const enrollments = payments.filter((p) => p.type === "enrollment" && p.status !== "paid");
    for (const p of enrollments) {
      await ctx.db.patch(p._id, { status: "paid", paidAt: p.dueDate });
    }
    return { updated: enrollments.length };
  },
});

export const clearStudents = mutation({
  args: {},
  handler: async (ctx) => {
    const students = await ctx.db.query("students").collect();
    for (const s of students) {
      const payments = await ctx.db.query("payments").withIndex("by_student", (q) => q.eq("studentId", s._id)).collect();
      for (const p of payments) await ctx.db.delete(p._id);
      const attendance = await ctx.db.query("attendance").withIndex("by_student", (q) => q.eq("studentId", s._id)).collect();
      for (const a of attendance) await ctx.db.delete(a._id);
      await ctx.db.delete(s._id);
    }
    return { deleted: students.length };
  },
});

export const seedStudents = mutation({
  args: {},
  handler: async (ctx) => {
    // Helper: get existing slot by label or create it
    const getOrCreateSlot = async (
      label: string,
      days: string[],
      startTime: string,
      endTime: string,
      modalities: string[]
    ): Promise<Id<"timeSlots">> => {
      const existing = await ctx.db.query("timeSlots").collect();
      const found = existing.find((s) => s.label === label);
      if (found) return found._id;
      return ctx.db.insert("timeSlots", {
        label,
        days,
        startTime,
        endTime,
        isActive: true,
        maxCapacity: 20,
        modalities,
      });
    };

    // Time slots
    const slotLMV1500 = await getOrCreateSlot("LMV 3–4 pm", ["Mon", "Wed", "Fri"], "15:00", "16:00", ["lmv"]);
    const slotLMV1600 = await getOrCreateSlot("LMV 4–5 pm", ["Mon", "Wed", "Fri"], "16:00", "17:00", ["lmv"]);
    const slotLMV1700 = await getOrCreateSlot("LMV 5–6 pm", ["Mon", "Wed", "Fri"], "17:00", "18:00", ["lmv"]);
    const slotMJ1500 = await getOrCreateSlot("MJ 3–4 pm", ["Tue", "Thu"], "15:00", "16:00", ["mj"]);
    const slotMJ1600 = await getOrCreateSlot("MJ 4–5 pm", ["Tue", "Thu"], "16:00", "17:00", ["mj"]);
    const slotMJ1700 = await getOrCreateSlot("MJ 5–6 pm", ["Tue", "Thu"], "17:00", "18:00", ["mj"]);
    const slotAG5x0630 = await getOrCreateSlot("AG5x 6:30–7:30 am", ["Mon", "Tue", "Wed", "Thu", "Fri"], "06:30", "07:30", ["aquagym5x"]);
    const slotAG3x0800 = await getOrCreateSlot("AG3x LMV 8–9 am", ["Mon", "Wed", "Fri"], "08:00", "09:00", ["aquagym3x"]);
    const slotAG3x0900 = await getOrCreateSlot("AG3x LMV 9–10 am", ["Mon", "Wed", "Fri"], "09:00", "10:00", ["aquagym3x"]);
    const slotAG3x1900 = await getOrCreateSlot("AG3x LMV 7–8 pm", ["Mon", "Wed", "Fri"], "19:00", "20:00", ["aquagym3x"]);
    const slotAG5x1900 = await getOrCreateSlot("AG5x 7–8 pm", ["Mon", "Tue", "Wed", "Thu", "Fri"], "19:00", "20:00", ["aquagym5x"]);

    type Modality = "lmv" | "mj" | "aquagym3x" | "aquagym5x";

    interface StudentInput {
      name: string;
      modality: Modality;
      timeSlotId: Id<"timeSlots">;
      enrollmentDate: string;
      monthlyAmount: number;
      enrollmentPaid: boolean;
      monthlyPaid: boolean;
      notes?: string;
      pendingPayment?: boolean;
    }

    const students: StudentInput[] = [
      // ── NATACION ── LMV 15:00–16:00 ──────────────────────────────────────
      { name: "JORGE ZAID ZEBALLOS",     modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-04-06", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "ERIK BALDIVIEZO",         modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-03-23", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true },
      { name: "MAXIMILIANO MENDOZA",     modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-03-23", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true },
      { name: "JOSE VIRACOCHA",          modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-04-08", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "SERGIO VIRACOCHA",        modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-04-08", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "ALEXANDER DARIEL SANTOS", modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-03-18", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MARIANA ROMERO",          modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-03-27", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MATEO ROMERO",            modality: "lmv", timeSlotId: slotLMV1500, enrollmentDate: "2026-03-27", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },

      // ── NATACION ── LMV 16:00–17:00 ──────────────────────────────────────
      { name: "HECTOR CARRAZCO",          modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-30", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "ANTONIO VASQUEZ",          modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-16", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Llevó un lente de 70 Bs, pagó con QR" },
      { name: "IGNACIO VASQUEZ",          modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-16", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MATIAS GALLARDO",          modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-25", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "CESAR NICOLAS FERNADEZ",   modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-25", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Llevó un gorro engomado de 60 Bs, pagó por QR" },
      { name: "LUIS MANUEL BOLIVAR",      modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-25", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "VICTOR FRANCISCO MOSTAJO", modality: "lmv", timeSlotId: slotLMV1600, enrollmentDate: "2026-03-23", monthlyAmount: 400, enrollmentPaid: false, monthlyPaid: true, notes: "Asiste todos los días; martes y jueves a las 15:00" },

      // ── NATACION ── LMV 17:00–18:00 ──────────────────────────────────────
      { name: "ANTONELA BALDIVIEZO",  modality: "lmv", timeSlotId: slotLMV1700, enrollmentDate: "2026-03-18", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MICAELA LUJO",         modality: "lmv", timeSlotId: slotLMV1700, enrollmentDate: "2026-03-19", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Llevó gorro con lentes de 80 Bs, pagó con QR" },
      { name: "JAVIER LUJO",          modality: "lmv", timeSlotId: slotLMV1700, enrollmentDate: "2026-03-19", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "SANTIAGO ZUÑIGA",      modality: "lmv", timeSlotId: slotLMV1700, enrollmentDate: "2026-04-05", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Llevó un lente de 70 Bs, pagó en efectivo" },

      // ── NATACION ── MJ 15:00–16:00 ───────────────────────────────────────
      { name: "FRANCISCO VALDEZ",   modality: "mj", timeSlotId: slotMJ1500, enrollmentDate: "2026-03-10", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true, notes: "Llevó gorro con lentes de 80 Bs, pagó en efectivo" },
      { name: "IGNACIO RODRIGUEZ",  modality: "mj", timeSlotId: slotMJ1500, enrollmentDate: "2026-03-12", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "HUGO TAVERA",        modality: "mj", timeSlotId: slotMJ1500, enrollmentDate: "2026-03-19", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "BRIANA RODRIGUEZ",   modality: "mj", timeSlotId: slotMJ1500, enrollmentDate: "2026-03-24", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "JASCIEL RODRIGUEZ",  modality: "mj", timeSlotId: slotMJ1500, enrollmentDate: "2026-03-24", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "THIAGO CEBALLOS",    modality: "mj", timeSlotId: slotMJ1500, enrollmentDate: "2026-03-19", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },

      // ── NATACION ── MJ 16:00–17:00 ───────────────────────────────────────
      { name: "ARIADNA PEÑARRIETA",     modality: "mj", timeSlotId: slotMJ1600, enrollmentDate: "2026-03-22", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "JUAN PABLO PEÑARRIETA",  modality: "mj", timeSlotId: slotMJ1600, enrollmentDate: "2026-03-22", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "JULIETA MEDINA",         modality: "mj", timeSlotId: slotMJ1600, enrollmentDate: "2026-03-05", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "SAMIA CHALI",            modality: "mj", timeSlotId: slotMJ1600, enrollmentDate: "2026-03-05", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "MUCI CHALI",             modality: "mj", timeSlotId: slotMJ1600, enrollmentDate: "2026-03-05", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },
      { name: "ANDRES AGUILAR GARZON",  modality: "mj", timeSlotId: slotMJ1600, enrollmentDate: "2026-03-12", monthlyAmount: 220, enrollmentPaid: true,  monthlyPaid: true, notes: "Llevó gorro con lentes de 80 Bs, pagó con QR" },

      // ── NATACION ── MJ 17:00–18:00 ───────────────────────────────────────
      { name: "EDUAR ROMERO",            modality: "mj", timeSlotId: slotMJ1700, enrollmentDate: "2026-03-19", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Pasa miércoles para completar 3 días a la semana" },
      { name: "MAXIMILIANO ROMERO",      modality: "mj", timeSlotId: slotMJ1700, enrollmentDate: "2026-03-19", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Pasa miércoles para completar 3 días a la semana" },
      { name: "OCTAVIA SUCCI CHAVARRIA", modality: "mj", timeSlotId: slotMJ1700, enrollmentDate: "2026-03-10", monthlyAmount: 220, enrollmentPaid: true,  monthlyPaid: true },
      { name: "VALENTINA NUÑEZ",         modality: "mj", timeSlotId: slotMJ1700, enrollmentDate: "2026-03-06", monthlyAmount: 220, enrollmentPaid: false, monthlyPaid: true },

      // ── AGUA GYM ── Todos los días 6:30–7:30 ─────────────────────────────
      { name: "MABEL HIZA",    modality: "aquagym5x", timeSlotId: slotAG5x0630, enrollmentDate: "2026-04-13", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: true },
      { name: "ANA ROSAS",     modality: "aquagym5x", timeSlotId: slotAG5x0630, enrollmentDate: "2026-04-07", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: true },
      { name: "CARMEN SANCHEZ",modality: "aquagym5x", timeSlotId: slotAG5x0630, enrollmentDate: "2026-04-13", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: true },
      { name: "VIVIAN VACA",   modality: "aquagym5x", timeSlotId: slotAG5x0630, enrollmentDate: "2026-04-16", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: false },

      // ── AGUA GYM ── LMV 8:00–9:00 ────────────────────────────────────────
      { name: "CECILIA ZAMBRANA", modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-02-25", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: false, pendingPayment: true },
      { name: "ROSA MARTINEZ",    modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-04-06", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Asiste martes, jueves y viernes" },
      { name: "NATTY DURAN",      modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-02-19", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "JAQUELIN SEGOVIA", modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-04-26", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "ROXANA VIOREL",    modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-04-06", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MARCELA RIVERA",   modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-03-25", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true },
      { name: "ERLINDA GONZALES", modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-04-13", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: false, pendingPayment: true },
      { name: "BERTHA VALDEZ",    modality: "aquagym3x", timeSlotId: slotAG3x0800, enrollmentDate: "2026-04-13", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: false, notes: "Pagó 100 Bs, debe 150 Bs" },

      // ── AGUA GYM ── LMV 9:00–10:00 ───────────────────────────────────────
      { name: "FATIMA CASASOLA",       modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-03-14", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MARIA LUISA GRANDSHANT",modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-03-07", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MERCEDES LA FUENTE",    modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-03-25", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MARITA OLLER",          modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-03-02", monthlyAmount: 200, enrollmentPaid: false, monthlyPaid: true },
      { name: "ELIANA MEYER",          modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-04-06", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "AURORA MORALES",        modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-04-13", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "MARIA EUGENIA DONOSO",  modality: "aquagym3x", timeSlotId: slotAG3x0900, enrollmentDate: "2026-04-08", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true, notes: "Debe 60 Bs de inscripción" },

      // ── AGUA GYM ── LMV/MJ 19:00–20:00 ──────────────────────────────────
      { name: "MARLENNE",          modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-02-23", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "ROSSE",             modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-02-23", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "SONIA QUISBERT",    modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-12", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Llevó lente+gorro 80 Bs y gorro 70 Bs; pagó solo 50 Bs, debe 100 Bs" },
      { name: "SANDRA ANNAS",      modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-30", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "WALTER MALDONADO",  modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-12", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "ESPOSA MALDONADO",  modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-12", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true },
      { name: "LORENA BENITEZ",    modality: "aquagym5x", timeSlotId: slotAG5x1900, enrollmentDate: "2026-04-02", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: true },
      { name: "ELIDA BENITEZ",     modality: "aquagym5x", timeSlotId: slotAG5x1900, enrollmentDate: "2026-04-02", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: true },
      { name: "KADDY VACA",        modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-04", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true, notes: "Debe 70 Bs de un gorro" },
      { name: "DEIDY VACA",        modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-04", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true, notes: "Llevó gorro con orejera 70 Bs, pagó con QR" },
      { name: "MIRTHA FLORES",     modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-04-03", monthlyAmount: 250, enrollmentPaid: false, monthlyPaid: true, notes: "Asiste martes, jueves y viernes" },
      { name: "MARITZA VALERIANO", modality: "aquagym5x", timeSlotId: slotAG5x1900, enrollmentDate: "2026-04-08", monthlyAmount: 280, enrollmentPaid: false, monthlyPaid: true },
      { name: "EVA CRUZ",          modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-23", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true, notes: "Llevó gorro 60 Bs, pagó en efectivo" },
      { name: "GLADIS HURTADO",    modality: "aquagym3x", timeSlotId: slotAG3x1900, enrollmentDate: "2026-03-23", monthlyAmount: 250, enrollmentPaid: true,  monthlyPaid: true, notes: "Llevó gorro con orejera 70 Bs, pagó en efectivo" },
    ];

    let inserted = 0;
    for (const s of students) {
      const studentId = await ctx.db.insert("students", {
        name: s.name,
        phone: "",
        dob: "",
        enrollmentDate: s.enrollmentDate,
        modality: s.modality,
        timeSlotId: s.timeSlotId,
        status: "active",
        notes: s.notes,
        createdAt: Date.now(),
      });

      // Enrollment payment
      await ctx.db.insert("payments", {
        studentId,
        type: "enrollment",
        amount: 60,
        dueDate: s.enrollmentDate,
        status: s.enrollmentPaid ? "paid" : "pending",
        paidAt: s.enrollmentPaid ? s.enrollmentDate : undefined,
      });

      // Monthly payment (current month)
      const enrollDate = new Date(s.enrollmentDate + "T00:00:00");
      const monthStr = `${enrollDate.getFullYear()}-${String(enrollDate.getMonth() + 1).padStart(2, "0")}`;
      const dueDate = new Date(enrollDate);
      dueDate.setMonth(dueDate.getMonth() + 1);
      dueDate.setDate(1);
      const dueDateStr = dueDate.toISOString().split("T")[0];

      await ctx.db.insert("payments", {
        studentId,
        type: "monthly",
        amount: s.monthlyAmount,
        dueDate: dueDateStr,
        status: s.pendingPayment ? "pending" : s.monthlyPaid ? "paid" : "pending",
        paidAt: s.monthlyPaid && !s.pendingPayment ? s.enrollmentDate : undefined,
        month: monthStr,
      });

      inserted++;
    }

    return { inserted };
  },
});

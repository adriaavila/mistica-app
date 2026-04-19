import { clsx, type ClassValue } from "clsx";
import { twMerge } from "tailwind-merge";

export function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

export function formatCurrency(amount: number, currency = "Bs") {
  return `${amount.toLocaleString("es-VE")} ${currency}`;
}

export function formatDate(dateStr: string, options?: Intl.DateTimeFormatOptions) {
  const date = new Date(dateStr + "T00:00:00");
  return date.toLocaleDateString("es-VE", options ?? { day: "numeric", month: "short", year: "numeric" });
}

export function getRelativeDays(dateStr: string): { days: number; label: string; urgency: "overdue" | "soon" | "normal" } {
  const today = new Date();
  today.setHours(0,0,0,0);
  const target = new Date(dateStr + "T00:00:00");
  const diff = Math.round((target.getTime() - today.getTime()) / (1000*60*60*24));
  if (diff < 0) return { days: diff, label: `Venció hace ${Math.abs(diff)} día${Math.abs(diff)!==1?"s":""}`, urgency: "overdue" };
  if (diff === 0) return { days: 0, label: "Vence hoy", urgency: "soon" };
  if (diff <= 7) return { days: diff, label: `Vence en ${diff} día${diff!==1?"s":""}`, urgency: "soon" };
  return { days: diff, label: `Vence ${formatDate(dateStr)}`, urgency: "normal" };
}

export const MODALITY_LABELS: Record<string, string> = {
  lmv: "Natación LMV", mj: "Natación MJ",
  aquagym3x: "Aqua Gym 3x", aquagym5x: "Aqua Gym 5x",
};

export const MODALITY_SHORT: Record<string, string> = {
  lmv: "LMV", mj: "MJ", aquagym3x: "AG3x", aquagym5x: "AG5x",
};

export const MODALITY_COLORS: Record<string, { bg: string; color: string }> = {
  lmv:       { bg: "#E0F2FE", color: "#0284C7" },
  mj:        { bg: "#F3E8FF", color: "#7E22CE" },
  aquagym3x: { bg: "#DCFCE7", color: "#166534" },
  aquagym5x: { bg: "#FFF7ED", color: "#9A3412" },
};

export const DAY_LABELS: Record<string, string> = {
  Mon:"Lun", Tue:"Mar", Wed:"Mié", Thu:"Jue", Fri:"Vie", Sat:"Sáb", Sun:"Dom",
};

export function getTodaysDayOfWeek(): string {
  const days = ["Sun","Mon","Tue","Wed","Thu","Fri","Sat"];
  return days[new Date().getDay()];
}

export function isTodaysSlot(days: string[]): boolean {
  return days.includes(getTodaysDayOfWeek());
}

export function getGreeting(): string {
  const h = new Date().getHours();
  if (h < 12) return "Buenos días";
  if (h < 18) return "Buenas tardes";
  return "Buenas noches";
}

export function formatMonth(monthStr: string): string {
  const [year, month] = monthStr.split("-");
  const months = ["Enero","Febrero","Marzo","Abril","Mayo","Junio","Julio","Agosto","Septiembre","Octubre","Noviembre","Diciembre"];
  return `${months[parseInt(month)-1]} ${year}`;
}

export function todayStr(): string {
  return new Date().toISOString().split("T")[0];
}

export function getInitials(name: string): string {
  const parts = name.trim().split(" ");
  if (parts.length >= 2) return (parts[0][0] + parts[1][0]).toUpperCase();
  return name.slice(0, 2).toUpperCase();
}

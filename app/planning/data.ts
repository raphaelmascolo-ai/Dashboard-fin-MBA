// Module Planning Chantiers — types et helpers

export type WorkerRole = "ouvrier" | "chef" | "grutier";

export interface Worker {
  id: string;
  firstName: string;
  lastName: string;
  role: WorkerRole;
  active: boolean;
}

export interface Site {
  id: string;
  name: string;
  location: string | null;
  color: string | null;
  active: boolean;
  system: boolean;
  sortOrder: number;
}

export interface Assignment {
  id: string;
  workerId: string;
  siteId: string;
  dayDate: string; // YYYY-MM-DD
}

export interface Holiday {
  dayDate: string;
  label: string;
}

export const SYSTEM_LEAVE_ID = "SYS-LEAVE";
export const SYSTEM_INSURANCE_ID = "SYS-INSURANCE";
export const SYSTEM_SITE_IDS = [SYSTEM_LEAVE_ID, SYSTEM_INSURANCE_ID];

export const WEEKDAY_LABELS = ["Lundi", "Mardi", "Mercredi", "Jeudi", "Vendredi"];
export const WEEKDAY_SHORT = ["Lun", "Mar", "Mer", "Jeu", "Ven"];

// ── Week math (ISO: lundi = jour 1) ───────────────────────────────────────────
export function startOfWeek(d: Date): Date {
  const day = d.getDay(); // 0=Sun, 1=Mon, ..., 6=Sat
  const diff = day === 0 ? -6 : 1 - day;
  const r = new Date(d);
  r.setDate(d.getDate() + diff);
  r.setHours(0, 0, 0, 0);
  return r;
}

export function addDays(d: Date, n: number): Date {
  const r = new Date(d);
  r.setDate(r.getDate() + n);
  return r;
}

export function toIsoDate(d: Date): string {
  const y = d.getFullYear();
  const m = String(d.getMonth() + 1).padStart(2, "0");
  const dd = String(d.getDate()).padStart(2, "0");
  return `${y}-${m}-${dd}`;
}

export function fromIsoDate(s: string): Date {
  const [y, m, d] = s.split("-").map(Number);
  return new Date(y, m - 1, d);
}

export function weekDates(monday: Date): Date[] {
  return [0, 1, 2, 3, 4].map((i) => addDays(monday, i));
}

// Renvoie le jour ouvré suivant (Lun-Ven). Vendredi → Lundi suivant, week-end → Lundi.
export function nextWorkday(d: Date): Date {
  const day = d.getDay();
  if (day === 5) return addDays(d, 3); // Ven → Lun
  if (day === 6) return addDays(d, 2); // Sam → Lun
  if (day === 0) return addDays(d, 1); // Dim → Lun
  return addDays(d, 1);
}

// Renvoie le jour ouvré précédent (Lun-Ven). Lundi → Vendredi précédent.
export function previousWorkday(d: Date): Date {
  const day = d.getDay();
  if (day === 1) return addDays(d, -3); // Lun → Ven
  if (day === 0) return addDays(d, -2); // Dim → Ven
  if (day === 6) return addDays(d, -1); // Sam → Ven
  return addDays(d, -1);
}

// Si la date tombe un week-end, ramène au lundi suivant.
export function clampToWorkday(d: Date): Date {
  const day = d.getDay();
  if (day === 0) return addDays(d, 1);
  if (day === 6) return addDays(d, 2);
  return d;
}

export function formatWeekRange(monday: Date): string {
  const friday = addDays(monday, 4);
  const sameMonth = monday.getMonth() === friday.getMonth();
  const sameYear = monday.getFullYear() === friday.getFullYear();
  const fmtDay = (d: Date) =>
    d.toLocaleDateString("fr-CH", { day: "numeric", month: sameMonth ? undefined : "long" });
  if (sameMonth) {
    return `Semaine du ${monday.getDate()} au ${friday.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  if (sameYear) {
    return `Semaine du ${fmtDay(monday)} au ${friday.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })}`;
  }
  return `Semaine du ${monday.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })} au ${friday.toLocaleDateString("fr-CH", { day: "numeric", month: "long", year: "numeric" })}`;
}

export function formatDayHeader(d: Date): string {
  return d.toLocaleDateString("fr-CH", { day: "2-digit", month: "2-digit" });
}

// Format long: "Lundi 14 avril 2026"
export function formatDayLong(d: Date): string {
  return d.toLocaleDateString("fr-CH", {
    weekday: "long",
    day: "numeric",
    month: "long",
    year: "numeric",
  });
}

// Format court avec jour de la semaine: "Lundi 14"
export function formatDayShort(d: Date): string {
  const weekday = d.toLocaleDateString("fr-CH", { weekday: "long" });
  return `${weekday.charAt(0).toUpperCase()}${weekday.slice(1)} ${d.getDate()}`;
}

// ── Couleurs par rôle ─────────────────────────────────────────────────────────
export function roleColor(role: WorkerRole): { bg: string; text: string; border: string } {
  switch (role) {
    case "chef":
      return { bg: "#fff4e0", text: "#bf5f1a", border: "#fbcfa1" };
    case "grutier":
      return { bg: "#e3f7e8", text: "#1e7d3a", border: "#a8e3b8" };
    case "ouvrier":
    default:
      return { bg: "#e8eef5", text: "#1d3a5f", border: "#bccfe5" };
  }
}

export function roleLabel(role: WorkerRole): string {
  switch (role) {
    case "chef": return "Chef d'équipe";
    case "grutier": return "Grutier";
    case "ouvrier": return "Ouvrier";
  }
}

export function roleShort(role: WorkerRole): string {
  switch (role) {
    case "chef": return "C";
    case "grutier": return "G";
    case "ouvrier": return "O";
  }
}

export function workerLabel(w: Worker): string {
  return `${w.firstName}${w.lastName ? " " + w.lastName.charAt(0) + "." : ""}`;
}

export function generateWorkerId(): string {
  return `WK-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function generateSiteId(): string {
  return `SITE-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 5).toUpperCase()}`;
}

export function generateAssignmentId(): string {
  return `AS-${Date.now().toString(36).toUpperCase()}-${Math.random().toString(36).slice(2, 7).toUpperCase()}`;
}

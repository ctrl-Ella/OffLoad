/**
 * The demo week, 19 to 25 September 2026, one entry per thing on a calendar.
 *
 * This file is meant to be edited by hand: add a line, run `npm run demo:seed`
 * again and the week is rebuilt. It is deliberately not full — the gaps are
 * where the clashes a demo needs get added.
 *
 * Titles are in Spanish because this is what the family sees in their own
 * Google Calendar, and the people are real accounts in the core circle.
 */

export type DemoEvent = {
  /** `YYYY-MM-DD`. Europe/Madrid, which the script applies. */
  date: string;
  /** `HH:MM`, 24 hours. */
  from: string;
  to: string;
  title: string;
  place?: string;
};

/**
 * Keyed by the `name` in the `people` table, which is how the script matches a
 * row to its agenda.
 */
export const agenda: Record<string, DemoEvent[]> = {
  Elvia: [
    { date: "2026-09-19", from: "11:00", to: "12:00", title: "Compra semanal", place: "Mercadona" },

    // Do not round these times: Zona Franca to Nou Barris is 35 minutes at
    // city speed and the gap is 30, so five minutes is the whole scene.
    { date: "2026-09-20", from: "14:00", to: "18:30", title: "Turno en el trabajo", place: "Trabajo de Elvia" },
    { date: "2026-09-20", from: "19:00", to: "20:00", title: "Natación del niño", place: "Piscina" },

    { date: "2026-09-21", from: "09:00", to: "17:00", title: "Trabajo" },
    { date: "2026-09-21", from: "18:30", to: "19:30", title: "Fisioterapia", place: "Carrer de Sants 42" },

    { date: "2026-09-22", from: "09:00", to: "17:00", title: "Trabajo" },

    { date: "2026-09-23", from: "09:00", to: "17:00", title: "Trabajo" },
    { date: "2026-09-23", from: "19:00", to: "20:00", title: "Reunión de vecinos" },

    { date: "2026-09-24", from: "09:00", to: "17:00", title: "Trabajo" },
    { date: "2026-09-24", from: "17:45", to: "18:30", title: "Dentista", place: "Clínica Bonanova" },

    { date: "2026-09-25", from: "09:00", to: "15:00", title: "Trabajo (jornada corta)" },
  ],

  Carlos: [
    { date: "2026-09-19", from: "10:00", to: "11:30", title: "Pádel con Nicolás", place: "Club Esportiu Sants" },

    // Sunday the 20th stays clear on his side: the proposal names someone in
    // the core only when their calendar is free in the slot.
    { date: "2026-09-21", from: "08:00", to: "16:00", title: "Trabajo" },

    { date: "2026-09-22", from: "08:00", to: "16:00", title: "Trabajo" },
    { date: "2026-09-22", from: "18:00", to: "19:00", title: "Clase de inglés" },

    { date: "2026-09-23", from: "08:00", to: "16:00", title: "Trabajo" },

    { date: "2026-09-24", from: "08:00", to: "16:00", title: "Trabajo" },
    { date: "2026-09-24", from: "20:30", to: "22:30", title: "Cena con el equipo", place: "Poble Sec" },

    { date: "2026-09-25", from: "08:00", to: "16:00", title: "Trabajo" },
    { date: "2026-09-25", from: "16:30", to: "17:30", title: "Revisión del coche", place: "Taller Gràcia" },
  ],
};

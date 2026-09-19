"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Mic2 } from "lucide-react";

type CalendarEvent = { time: string; title: string; detail: string; tone: "accent" | "alert" | "neutral" };

const exampleEvents: Record<number, CalendarEvent[]> = {
  1: [{ time: "09:00", title: "Start of the week", detail: "Elvia and Carlos · Family plans", tone: "accent" }],
  2: [{ time: "17:00", title: "Pick up Nicolás", detail: "Carlos · School", tone: "alert" }],
  3: [{ time: "18:30", title: "Time for yourself", detail: "Elvia · Walk", tone: "neutral" }],
  4: [{ time: "17:00", title: "Pick up Nicolás", detail: "Coordination needed", tone: "alert" }],
  5: [{ time: "16:30", title: "Weekend plans", detail: "Family · To be confirmed", tone: "accent" }],
  6: [{ time: "11:30", title: "Nicolás's game", detail: "Carlos · Sports center", tone: "alert" }, { time: "17:00", title: "Coffee and a good book", detail: "Elvia · Personal time", tone: "neutral" }],
  0: [{ time: "10:00", title: "Family breakfast", detail: "An easy start to the day", tone: "accent" }],
};

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(monday, -((monday.getDay() + 6) % 7));
}

function sameDay(a: Date, b: Date) {
  return a.getFullYear() === b.getFullYear() && a.getMonth() === b.getMonth() && a.getDate() === b.getDate();
}

export function PresentationCalendar({ today: todayString }: { today: string }) {
  const [year, month, day] = todayString.split("-").map(Number);
  const today = new Date(year, month - 1, day);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedDay, setSelectedDay] = useState(today.getDay());
  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(today), weekOffset * 7 + index));
  const selected = days.find(day => day.getDay() === selectedDay) ?? days[0];
  const events = exampleEvents[selected.getDay()];

  return (
    <section id="agenda" className="presentation-calendar-section" aria-labelledby="calendar-title">
      <div className="presentation-calendar-heading">
        <div><span className="presentation-section-label">FAMILY CALENDAR</span><h2 id="calendar-title">Your week at a glance.</h2></div>
        <span className="presentation-demo-badge">SAMPLE VIEW</span>
      </div>
      <div className="presentation-calendar-card">
        <div className="presentation-calendar-toolbar">
          <div className="presentation-calendar-title"><span><CalendarDays size={21} aria-hidden="true" /></span><div><strong>Family calendar</strong><small>{monthFormatter.format(selected)}</small></div></div>
          <div className="presentation-calendar-navigation"><button type="button" onClick={() => setWeekOffset(value => value - 1)} aria-label="Previous week"><ChevronLeft size={19} /></button><button type="button" onClick={() => { setWeekOffset(0); setSelectedDay(today.getDay()); }}>Today</button><button type="button" onClick={() => setWeekOffset(value => value + 1)} aria-label="Next week"><ChevronRight size={19} /></button></div>
        </div>
        <div className="presentation-week" role="group" aria-label="Choose a day of the week">
          {days.map(day => <button type="button" key={day.toDateString()} className={sameDay(day, selected) ? "is-selected" : ""} onClick={() => setSelectedDay(day.getDay())} aria-pressed={sameDay(day, selected)}><span>{dayFormatter.format(day)}</span><strong>{day.getDate()}</strong><i aria-hidden="true" /></button>)}
        </div>
        <div className="presentation-agenda-content">
          <div className="presentation-agenda-list"><h3>{fullDateFormatter.format(selected)}</h3><div className="presentation-events">{events.map(event => <div className="presentation-event" key={`${event.time}-${event.title}`}><time>{event.time}</time><div className={`presentation-event-body presentation-event-${event.tone}`}><strong>{event.title}</strong><span>{event.detail}</span></div></div>)}</div><p className="presentation-calendar-disclaimer">Illustrative example · Calendar sync is in development.</p></div>
          <aside className="presentation-calendar-insight"><span><Mic2 size={22} aria-hidden="true" /></span><h3>Something else to remember?</h3><p>Leave it in a voice note.</p><Link href="/offload"><Mic2 size={17} aria-hidden="true" /> Go to Offload</Link></aside>
        </div>
      </div>
    </section>
  );
}

"use client";

import { useState } from "react";
import Link from "next/link";
import { CalendarDays, ChevronLeft, ChevronRight, Mic2 } from "lucide-react";
import type { CalendarEntry, CalendarStatus } from "@/lib/calendar-entries";

/**
 * The family calendar on the home screen: what is on Elvia's and Carlos's
 * Google calendars, read on the server and handed here already formatted.
 * The widget browses the weeks it was given and no further: a week it has no
 * data for would read as a free week, and that is a claim nobody made.
 */

const dayFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "short" });
const monthFormatter = new Intl.DateTimeFormat("en-GB", { month: "long", year: "numeric" });
const fullDateFormatter = new Intl.DateTimeFormat("en-GB", { weekday: "long", day: "numeric", month: "long" });

/** What each calendar status reads as, beside the person's name. */
const STATUS_LINE: Record<CalendarStatus["status"], string> = {
  ready: "synced with Google",
  "no-google": "Google not connected yet",
  expired: "Google connection expired, sign in with Google again",
  unavailable: "Google didn't answer",
};

function addDays(date: Date, amount: number) {
  const result = new Date(date);
  result.setDate(result.getDate() + amount);
  return result;
}

function startOfWeek(date: Date) {
  const monday = new Date(date.getFullYear(), date.getMonth(), date.getDate());
  return addDays(monday, -((monday.getDay() + 6) % 7));
}

/** `YYYY-MM-DD` of a local date, which is how the entries are keyed. */
function key(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, "0")}-${String(date.getDate()).padStart(2, "0")}`;
}

export function PresentationCalendar({
  today: todayString,
  entries,
  calendars,
  weeksBefore,
  weeksAfter,
}: {
  /** `YYYY-MM-DD` in the household's zone. Selected by default. */
  today: string;
  entries: CalendarEntry[];
  calendars: CalendarStatus[];
  /** How many weeks either side of today's the entries cover. */
  weeksBefore: number;
  weeksAfter: number;
}) {
  const [year, month, day] = todayString.split("-").map(Number);
  const today = new Date(year, month - 1, day);
  const [weekOffset, setWeekOffset] = useState(0);
  const [selectedKey, setSelectedKey] = useState(todayString);

  const days = Array.from({ length: 7 }, (_, index) => addDays(startOfWeek(today), weekOffset * 7 + index));
  const selected = days.find((d) => key(d) === selectedKey) ?? days[0];
  const events = entries.filter((entry) => entry.date === key(selected));
  const anySynced = calendars.some((calendar) => calendar.status === "ready");

  function moveWeek(delta: number) {
    const next = weekOffset + delta;
    setWeekOffset(next);
    // Keep the same weekday selected when moving, so the list never goes stale.
    setSelectedKey(key(addDays(selected, delta * 7)));
  }

  return (
    <section id="agenda" className="presentation-calendar-section" aria-labelledby="calendar-title">
      <div className="presentation-calendar-heading">
        <div><span className="presentation-section-label">FAMILY CALENDAR</span><h2 id="calendar-title">Your week, at a glance.</h2></div>
        <span className="presentation-demo-badge">{anySynced ? "GOOGLE CALENDAR" : "NOT SYNCED"}</span>
      </div>
      <div className="presentation-calendar-card">
        <div className="presentation-calendar-toolbar">
          <div className="presentation-calendar-title"><span><CalendarDays size={21} aria-hidden="true" /></span><div><strong>Family calendar</strong><small>{monthFormatter.format(selected)}</small></div></div>
          <div className="presentation-calendar-navigation">
            <button type="button" onClick={() => moveWeek(-1)} disabled={weekOffset <= -weeksBefore} aria-label="Previous week"><ChevronLeft size={19} /></button>
            <button type="button" onClick={() => { setWeekOffset(0); setSelectedKey(todayString); }}>Today</button>
            <button type="button" onClick={() => moveWeek(1)} disabled={weekOffset >= weeksAfter} aria-label="Next week"><ChevronRight size={19} /></button>
          </div>
        </div>
        <div className="presentation-week" role="group" aria-label="Select a day of the week">
          {days.map((d) => {
            const isToday = key(d) === todayString;
            const hasEvents = entries.some((entry) => entry.date === key(d));

            return (
              <button
                type="button"
                key={key(d)}
                className={key(d) === key(selected) ? "is-selected" : ""}
                onClick={() => setSelectedKey(key(d))}
                aria-pressed={key(d) === key(selected)}
                aria-label={`${fullDateFormatter.format(d)}${isToday ? ", today" : ""}${hasEvents ? "" : ", nothing on the calendar"}`}
              >
                <span>{isToday ? "Today" : dayFormatter.format(d)}</span>
                <strong>{d.getDate()}</strong>
                {hasEvents ? <i aria-hidden="true" /> : null}
              </button>
            );
          })}
        </div>
        <div className="presentation-agenda-content">
          <div className="presentation-agenda-list">
            <h3>{fullDateFormatter.format(selected)}{key(selected) === todayString ? " · today" : ""}</h3>
            <div className="presentation-events">
              {events.length === 0 ? (
                <p className="presentation-calendar-disclaimer">
                  {anySynced ? "Nothing on the calendar this day." : "No calendar could be read."}
                </p>
              ) : (
                events.map((event) => (
                  <div className="presentation-event" key={`${event.person}-${event.time}-${event.title}`}>
                    <time>{event.time}</time>
                    <div className={`presentation-event-body presentation-event-${event.clash ? "alert" : event.pending ? "neutral" : "accent"}`}>
                      <strong>{event.title}</strong>
                      <span>
                        {event.person} · {event.time}–{event.endTime}
                        {event.pending ? " · told to Mia, not on the calendar yet" : ""}
                        {event.clash ? " · doesn't fit" : ""}
                      </span>
                    </div>
                  </div>
                ))
              )}
            </div>
            {/* Whose calendar this is, and whether it could be read: an empty
                day on a calendar Google would not hand over is not a free day. */}
            <p className="presentation-calendar-disclaimer">
              {calendars.map((calendar) => `${calendar.person}: ${STATUS_LINE[calendar.status]}`).join(" · ")}
            </p>
          </div>
          <aside className="presentation-calendar-insight"><span><Mic2 size={22} aria-hidden="true" /></span><h3>Anything else to remember?</h3><p>Leave it in a voice note.</p><Link href="/offload"><Mic2 size={17} aria-hidden="true" /> Go to Offload</Link></aside>
        </div>
      </div>
    </section>
  );
}

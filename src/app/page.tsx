import type { Metadata } from "next";
import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Mic2, Sparkles, TriangleAlert } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { CallNotice } from "@/components/CallNotice";
import { PresentationCalendar } from "@/components/presentation-calendar";
import { TypingHeadline } from "@/components/typing-headline";
import { GoogleSignIn } from "@/components/google-sign-in";
import { PhoneSignIn } from "@/components/phone-sign-in";
import { Notice } from "@/components/ui/notice";
import { calendarEntries, calendarStatuses } from "@/lib/calendar-entries";
import { dayRange, todayInMadrid } from "@/lib/clock";
import { coreRange, type Lane } from "@/lib/schedule";
import { currentPerson, type SignedInPerson } from "@/lib/session";

/**
 * The door to OFFLOAD, and what is behind it.
 *
 * A server component, because the question that decides what gets painted —
 * who you are — can only be answered by the server: the session lives in an
 * httpOnly cookie the browser cannot read. The presentation screen (the
 * hero, Mia's mascot, the calendar preview) only exists for someone already
 * signed in; anyone else is asked to sign in first, and never sees it.
 */

export const metadata: Metadata = {
  title: "OFFLOAD",
  description:
    "Organising a family is a job. Let Mia do it. You sign in with your phone, and your carrier confirms it.",
};

type Props = { searchParams: Promise<{ google?: string }> };

export default async function HomePage({ searchParams }: Props) {
  const person = await currentPerson();
  const { google } = await searchParams;

  return person ? <Presentation person={person} /> : <Door googleOutcome={google} />;
}

/** What Google's callback redirects back with, when there is no session to
 *  show instead. Anything else — including a successful "connected" — needs
 *  no message here: signing in and landing on the presentation screen
 *  already says it worked. */
const GOOGLE_OUTCOMES: Record<string, string> = {
  "no-permission":
    "You didn't grant the permission, so I saved nothing. You can sign in with your phone.",
  unknown:
    "That Google account isn't in this household. Ask someone in the family to add you and sign in again.",
  "invalid-return": "The return from Google didn't come through properly. Try again.",
  failed: "I couldn't finish with Google. Try again in a moment.",
};

function Door({ googleOutcome }: Readonly<{ googleOutcome?: string }>) {
  const message = googleOutcome ? GOOGLE_OUTCOMES[googleOutcome] : undefined;

  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-11 pb-7 lg:max-w-4xl lg:px-10"
    >
      {/* Same mark as the presentation page's header (`AppNavigation`) —
          reused as-is, not rebuilt: this screen sits on the same cream
          background, so `.presentation-brand`'s colours already fit. */}
      <span className="presentation-brand">
        <Image src="/mia-still.png" alt="" width={38} height={42} />
        <span>offload<span className="presentation-brand-dot">.</span></span>
      </span>

      <div className="mt-12 flex min-h-0 flex-1 flex-col gap-8">
        <h1 className="font-display text-[2.125rem] leading-[1.1] text-ink lg:text-5xl">
          Organising a family is a job.{" "}
          <span className="text-accent-strong">Let Mia do it.</span>
        </h1>

        {message ? (
          <Notice tone="alert">
            <p>{message}</p>
          </Notice>
        ) : null}

        <div className="lg:max-w-md">
          <PhoneSignIn alternative={<GoogleSignIn />} />
        </div>
      </div>
    </main>
  );
}

/** How far the calendar browses either side of this week. Three weeks is
 *  what a family plans over; beyond that the arrows stop, because a week
 *  with nothing loaded would read as a free week. */
const WEEKS_BEFORE = 1;
const WEEKS_AFTER = 1;

const DAY_MS = 24 * 60 * 60 * 1000;

/** The instants the browsable weeks run between, Monday to Sunday, in the household's zone. */
function browsableRange(today: string): { from: Date; to: Date } {
  const { from: startOfToday } = dayRange(today);
  // Monday-based: `getUTCDay` of a Madrid midnight expressed in UTC is still
  // the same weekday, since the offset never crosses a day boundary.
  const weekday = (new Date(startOfToday.getTime() + 12 * 60 * 60 * 1000).getUTCDay() + 6) % 7;
  const monday = new Date(startOfToday.getTime() - weekday * DAY_MS);

  return {
    from: new Date(monday.getTime() - WEEKS_BEFORE * 7 * DAY_MS),
    to: new Date(monday.getTime() + (WEEKS_AFTER + 1) * 7 * DAY_MS),
  };
}

async function Presentation({ person }: Readonly<{ person: SignedInPerson }>) {
  const today = todayInMadrid();

  // Only the core has a calendar to read. For the support network nothing is
  // looked at, because there is nothing of theirs to look at. Both core
  // calendars are read at once: the family calendar shows the household,
  // and the day's status below the hero is the signed-in person's lane.
  const { from, to } = browsableRange(today);
  const lanes = person.circle === "CORE" ? await coreRange(from, to) : [];
  const lane = lanes.find((candidate) => candidate.personId === person.id);
  const todayKey = today;

  return (
    <div className="presentation-page">
      <AppNavigation person={person} />

      <main id="content">
        <section className="presentation-hero" aria-labelledby="presentation-title">
          <div className="presentation-hero-copy">
            <span className="presentation-eyebrow"><span /> A LIGHTER DAY</span>
            <TypingHeadline />
            <div className="presentation-actions">
              <Link className="presentation-button presentation-button-primary" href="/offload"><Mic2 size={18} aria-hidden="true" /> Leave a voice note</Link>
              <a className="presentation-button presentation-button-outline" href="#agenda">View calendar <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </div>
          <div className="presentation-hero-art">
            <div className="presentation-orbit presentation-orbit-one" />
            <div className="presentation-orbit presentation-orbit-two" />
            <div className="presentation-mascot">
              <Image className="presentation-mascot-animated" src="/mia-blink.gif" alt="Mia, Offload's assistant, blinking" width={360} height={400} unoptimized priority />
              <Image className="presentation-mascot-still" src="/mia-still.png" alt="Mia, Offload's assistant" width={360} height={400} priority />
            </div>
            <span className="presentation-note presentation-note-top"><Sparkles size={16} aria-hidden="true" /> Hi, I&apos;m Mia</span>
          </div>
        </section>

        {/* What the day can prove today, between the hero and the calendar
            preview: whether something clashes, and whether a call is open.
            Same width as the sections around it, so it reads as one page. */}
        {lane ? (
          <section
            id="today"
            aria-labelledby="today-heading"
            className="mx-auto flex w-[min(1240px,calc(100%-64px))] flex-col gap-4 pb-10"
          >
            <h2 id="today-heading" className="presentation-section-label">
              TODAY
            </h2>
            <DayStatus lane={lane} today={todayKey} />
            <CallNotice />
          </section>
        ) : null}

        <PresentationCalendar
          today={today}
          entries={calendarEntries(lanes)}
          calendars={calendarStatuses(lanes)}
          weeksBefore={WEEKS_BEFORE}
          weeksAfter={WEEKS_AFTER}
        />
      </main>
    </div>
  );
}

/**
 * The one thing the day can say today: whether something does not fit. The
 * three states are told apart because they mean different things — a free
 * day, a calendar Mia cannot see, and a calendar nobody has connected — and
 * painting the last two as the first would claim a free day nobody knows.
 */
function DayStatus({ lane, today }: Readonly<{ lane: Lane; today: string }>) {
  // The button is right here in both cases: the fix is one press, and sending
  // someone to look for it elsewhere is how a calendar stays disconnected.
  if (lane.status === "no-google") {
    return (
      <Notice tone="quiet" title="I can't see your calendar yet">
        <p className="mt-1">Connect your Google account and I&apos;ll look at your day.</p>
        <div className="mt-3 max-w-xs">
          <GoogleSignIn />
        </div>
      </Notice>
    );
  }

  if (lane.status === "expired") {
    return (
      <Notice tone="alert" title="Your Google connection has expired">
        <p className="mt-1">
          Google stopped renewing it. Sign in with Google once more and your calendar is back.
        </p>
        <div className="mt-3 max-w-xs">
          <GoogleSignIn />
        </div>
      </Notice>
    );
  }

  if (lane.status === "unavailable") {
    return (
      <Notice tone="quiet" title="I can't read your calendar right now">
        <p className="mt-1">Google didn&apos;t answer. Try again in a moment.</p>
      </Notice>
    );
  }

  // The lane covers three weeks; the status is about today, so the first
  // clash of today and not of the range. `/conflict` reads the day on its own.
  const { from, to } = dayRange(today);
  const clash = lane.conflicts.find(
    (candidate) => candidate.next.startsAt >= from && candidate.next.startsAt < to,
  );

  if (!clash) {
    return (
      <Notice tone="good" title="Nothing clashes today">
        <p className="mt-1">Everything on your calendar fits.</p>
      </Notice>
    );
  }

  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-alert p-4 text-ink">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-alert"
      >
        <TriangleAlert className="size-4" />
      </span>

      <p className="min-w-0 flex-1">
        <span className="block font-display font-semibold">Something doesn&apos;t fit today</span>
        <span className="block text-[15px]">
          You won&apos;t make it to &ldquo;{clash.next.title}&rdquo;.
        </span>
      </p>

      <Link
        href="/conflict"
        className="inline-flex min-h-11 items-center justify-center rounded-control border border-ink px-4 text-[15px] font-medium text-ink hover:bg-white/40"
      >
        See the clash
      </Link>
    </div>
  );
}

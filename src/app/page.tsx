import type { Metadata } from "next";
import Link from "next/link";
import { TriangleAlert, User } from "lucide-react";
import { todayInMadrid } from "@/lib/clock";
import { coreJourney, type Lane } from "@/lib/schedule";
import { currentPerson, type SignedInPerson } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { CallNotice } from "@/components/CallNotice";
import { GoogleSignIn } from "@/components/google-sign-in";
import { MiaFigure } from "@/components/mia";
import { MIA_SKY } from "@/components/mia-states";
import { PhoneSignIn } from "@/components/phone-sign-in";

/**
 * The door to OFFLOAD.
 *
 * Arriving and signing in are the same screen on purpose: the phone is the
 * identity here, with no password to remember and no account to create, so a
 * "Get started" in front would decide nothing.
 *
 * A server component, because the question that decides what gets painted —
 * who you are — can only be answered by the server: the session lives in an
 * httpOnly cookie the browser cannot read.
 */

export const metadata: Metadata = {
  title: "OFFLOAD",
  description:
    "Organizar a una familia es un trabajo. Que lo haga Mia. Se entra con el teléfono, que lo confirma tu operador.",
};

/** The greeting runs on the household's clock: the container runs in UTC and
 *  at ten at night it would say "buenas tardes". */
function greeting(): string {
  const hour = Number(
    new Intl.DateTimeFormat("es-ES", {
      hour: "numeric",
      hour12: false,
      timeZone: "Europe/Madrid",
    }).format(new Date()),
  );

  if (hour < 6 || hour >= 21) return "Buenas noches";
  if (hour < 14) return "Buenos días";
  return "Buenas tardes";
}

type Props = { searchParams: Promise<{ google?: string }> };

export default async function Home({ searchParams }: Props) {
  const person = await currentPerson();
  const { google } = await searchParams;

  return person ? <Inside person={person} /> : <Door googleOutcome={google} />;
}

/** What Google's callback redirects back with. Anything else is ignored. */
const GOOGLE_OUTCOMES: Record<string, string> = {
  "no-permission":
    "No has dado el permiso, así que no he guardado nada. Puedes entrar con tu teléfono.",
  unknown:
    "Esa cuenta de Google no está en esta casa. Que te añada alguien de la familia y vuelve a entrar.",
  "invalid-return": "La vuelta de Google no ha llegado bien. Vuelve a intentarlo.",
  failed: "No he podido terminar con Google. Vuelve a intentarlo en un momento.",
};

/**
 * Two compositions, not one. On a phone it is a column — Mia, the headline,
 * the two ways in — and on a desktop the text sits on one side and Mia on the
 * other: stretching the phone column to 1440px left the headline in four
 * short lines with half a metre of empty background above it.
 */
function Door({ googleOutcome }: Readonly<{ googleOutcome?: string }>) {
  const message = googleOutcome ? GOOGLE_OUTCOMES[googleOutcome] : undefined;

  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-11 pb-7 lg:max-w-6xl lg:px-10 lg:pt-8 lg:pb-10"
    >
      <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>

      <div className="flex min-h-0 flex-1 flex-col lg:flex-row lg:items-center lg:gap-16">
        {/* The figure alone, with no state label: nothing is running here yet.
            The height is declared rather than left to `flex-1`: scaled by the
            column's width, in phone landscape she pushed the headline and the
            buttons off the screen. */}
        <div className="relative my-4 flex h-[34vh] max-h-80 shrink-0 items-center justify-center lg:order-2 lg:my-0 lg:h-[26rem] lg:max-h-none lg:basis-96">
          {/* Overflows top and bottom only: she fills the box's height, so the
              sky needs room outside it to fade. Sideways overflow would bring
              a horizontal scrollbar. */}
          <div
            aria-hidden="true"
            className="pointer-events-none absolute inset-x-0 -inset-y-14"
            style={{ background: MIA_SKY }}
          />

          <MiaFigure state="quiet" className="relative h-full w-full" />
        </div>

        <div className="flex flex-col gap-8 lg:order-1 lg:flex-1">
          <h1 className="font-display text-[2.125rem] leading-[1.1] text-ink lg:text-5xl">
            Organizar a una familia es un trabajo.{" "}
            <span className="text-accent-strong">Que lo haga Mia.</span>
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
      </div>
    </main>
  );
}

async function Inside({ person }: Readonly<{ person: SignedInPerson }>) {
  // Only the core has a calendar to read. For the support network the day is
  // not looked at, because there is nothing of theirs to look at.
  const [lane] =
    person.circle === "CORE" ? await coreJourney(todayInMadrid(), person.id) : [undefined];

  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-11 pb-7 lg:max-w-4xl lg:px-10"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>

        {/* `details` and not a JavaScript menu: it opens and closes on its own,
            works with the keyboard, and hydrates nothing. */}
        <details className="relative">
          <summary
            aria-label="Tu perfil"
            className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted hover:bg-white [&::-webkit-details-marker]:hidden"
          >
            <User className="size-5" aria-hidden="true" />
          </summary>

          <div className="absolute right-0 z-10 mt-2 w-72 rounded-card border border-border bg-white p-4 shadow-sm">
            <p className="text-sm font-medium text-ink">{person.name}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Línea acabada en {person.phoneTail}, confirmada por tu operador. Te
              recuerdo treinta días.
            </p>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <Button type="submit" variant="secondary" size="small">
                Cerrar sesión
              </Button>
            </form>
          </div>
        </details>
      </div>

      <p className="py-8 text-[clamp(1rem,0.95rem+0.3vw,1.15rem)] text-ink-muted">
        {greeting()}, <span className="text-ink">{person.name}</span>. No tienes que
        cargar con todo.
      </p>

      {/* The day's timeline goes here. Until it exists, what the screen says
          is only what it can prove: whether something clashes today, and
          whether there is a call open. */}
      {lane ? (
        <DayStatus lane={lane} />
      ) : (
        <Notice tone="good" title="Ya estás dentro">
          <p className="mt-1">
            Tu día todavía no está aquí: esto de momento solo sabe quién eres.
          </p>
        </Notice>
      )}

      {person.circle === "CORE" && (
        <div className="mt-6">
          <CallNotice />
        </div>
      )}
    </main>
  );
}

/**
 * The one thing the day can say today: whether something does not fit. The
 * three states are told apart because they mean different things — a free
 * day, a calendar Mia cannot see, and a calendar nobody has connected — and
 * painting the last two as the first would claim a free day nobody knows.
 */
function DayStatus({ lane }: Readonly<{ lane: Lane }>) {
  if (lane.status === "no-google") {
    return (
      <Notice tone="quiet" title="I can't see your calendar yet">
        <p className="mt-1">Connect your Google account and I&apos;ll look at your day.</p>
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

  const clash = lane.conflicts[0];

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

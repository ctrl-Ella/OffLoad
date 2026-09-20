import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Mic2, Sparkles } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { PresentationCalendar } from "@/components/presentation-calendar";
import { TypingHeadline } from "@/components/typing-headline";
import { GoogleSignIn } from "@/components/google-sign-in";
import { PhoneSignIn } from "@/components/phone-sign-in";
import { Notice } from "@/components/ui/notice";
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
    "No has dado el permiso, así que no he guardado nada. Puedes entrar con tu teléfono.",
  unknown:
    "Esa cuenta de Google no está en esta casa. Que te añada alguien de la familia y vuelve a entrar.",
  "invalid-return": "La vuelta de Google no ha llegado bien. Vuelve a intentarlo.",
  failed: "No he podido terminar con Google. Vuelve a intentarlo en un momento.",
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
    </main>
  );
}

function Presentation({ person }: Readonly<{ person: SignedInPerson }>) {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

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

        <PresentationCalendar today={today} />
      </main>
    </div>
  );
}

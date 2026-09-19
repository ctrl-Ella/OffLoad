import type { Metadata } from "next";
import { User } from "lucide-react";
import { currentPerson, type SignedInPerson } from "@/lib/session";
import { Button } from "@/components/ui/button";
import { Notice } from "@/components/ui/notice";
import { GoogleSignIn } from "@/components/google-sign-in";
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

function Door({ googleOutcome }: Readonly<{ googleOutcome?: string }>) {
  const message = googleOutcome ? GOOGLE_OUTCOMES[googleOutcome] : undefined;

  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-11 pb-7 lg:max-w-4xl lg:px-10"
    >
      <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>

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

function Inside({ person }: Readonly<{ person: SignedInPerson }>) {
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

      {/* The day's timeline goes here. Until it exists, the screen says only
          what it can prove: that it knows who you are. */}
      <Notice title="Ya estás dentro">
        <p className="mt-1">
          Tu día todavía no está aquí: esto de momento solo sabe quién eres.
        </p>
      </Notice>
    </main>
  );
}

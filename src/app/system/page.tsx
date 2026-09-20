import type { Metadata } from "next";
import { CallBanner } from "@/components/CallNotice";
import { ConflictBreakdown } from "@/components/ConflictBreakdown";
import { Mia } from "@/components/mia";
import { MIA_STATE_ORDER } from "@/components/mia-states";
import type { Conflict, Stop } from "@/lib/conflicts";
import { MiaLive } from "./mia-live";

/**
 * Declared examples for the reference page, and only for it: the conflict
 * screen reads real calendars, this page shows what each shape looks like.
 */
function exampleStop(title: string, from: string, to: string): Stop {
  return {
    id: title,
    personId: "example",
    title,
    startsAt: new Date(`2026-09-24T${from}:00+02:00`),
    endsAt: new Date(`2026-09-24T${to}:00+02:00`),
    place: null,
  };
}

const OVERLAP: Conflict = {
  reason: "overlap",
  previous: exampleStop("Reunión de equipo", "16:00", "17:30"),
  next: exampleStop("Recoger al niño", "17:00", "17:30"),
  gapMin: -30,
  travelMin: null,
};

const NO_TIME: Conflict = {
  reason: "no-time",
  previous: exampleStop("Trabajo", "09:00", "17:00"),
  next: exampleStop("Piscina", "17:05", "18:00"),
  gapMin: 5,
  travelMin: 42,
};

/**
 * The living reference: every state of every component, side by side. A
 * component that is not on this page is a component nobody will find.
 */

export const metadata: Metadata = {
  title: "Sistema · OFFLOAD",
  description: "Los componentes de OFFLOAD y todos sus estados, en una sola página.",
};

export default function SystemPage() {
  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 px-6 pt-11 pb-7 lg:max-w-4xl lg:px-10"
    >
      <header>
        <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>
        <h1 className="mt-6 font-display text-[2rem] leading-[1.1] text-ink">Sistema</h1>
        <p className="mt-3 text-ink-muted">Cada componente con todos sus estados a la vez.</p>
      </header>

      <section aria-labelledby="mia-heading" className="flex flex-col gap-6">
        <h2 id="mia-heading" className="font-display text-2xl text-ink">
          Mia
        </h2>
        <p className="max-w-prose text-ink-muted">
          Cinco estados, y cada uno corresponde a algo que el sistema sabe. Cuatro conservan la
          cara y se distinguen por un objeto; solo «Hablando» vacía el cristal.
        </p>

        <ul className="grid grid-cols-2 gap-6 sm:grid-cols-3 lg:grid-cols-5">
          {MIA_STATE_ORDER.map((state, i) => (
            <li
              key={state}
              className="w-36"
              // Staggered so five Mias do not bob in unison.
              style={{ "--mia-delay": `${-i * 0.9}s` } as React.CSSProperties}
            >
              <Mia state={state} />
            </li>
          ))}
        </ul>

        <h3 className="text-lg font-medium text-ink">Las transiciones</h3>
        <MiaLive />
      </section>

      <section aria-labelledby="conflict-heading" className="flex flex-col gap-6">
        <h2 id="conflict-heading" className="font-display text-2xl text-ink">
          El choque
        </h2>
        <p className="max-w-prose text-ink-muted">
          Dos formas, porque son dos cosas distintas: solaparse es aritmética exacta, y no dar
          tiempo lleva dentro una estimación de trayecto que se declara como tal.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-medium text-ink">Se solapan</h3>
            <ConflictBreakdown conflict={OVERLAP} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-medium text-ink">No da tiempo</h3>
            <ConflictBreakdown conflict={NO_TIME} />
          </div>
        </div>
      </section>

      <section aria-labelledby="call-heading" className="flex flex-col gap-6">
        <h2 id="call-heading" className="font-display text-2xl text-ink">
          La llamada
        </h2>
        <p className="max-w-prose text-ink-muted">
          El aviso que ve quien no la ha abierto. La sala no tiene ejemplo aquí: solo sabe pintar
          una llamada de verdad, con sus permisos de cámara y su sesión abierta.
        </p>

        <CallBanner who="Carlos" />
      </section>
    </main>
  );
}

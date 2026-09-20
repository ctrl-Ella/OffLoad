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
  title: "System · OFFLOAD",
  description: "OFFLOAD's components and every one of their states, on a single page.",
};

export default function SystemPage() {
  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col gap-12 px-6 pt-11 pb-7 lg:max-w-4xl lg:px-10"
    >
      <header>
        <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>
        <h1 className="mt-6 font-display text-[2rem] leading-[1.1] text-ink">System</h1>
        <p className="mt-3 text-ink-muted">Every component with all of its states at once.</p>
      </header>

      <section aria-labelledby="mia-heading" className="flex flex-col gap-6">
        <h2 id="mia-heading" className="font-display text-2xl text-ink">
          Mia
        </h2>
        <p className="max-w-prose text-ink-muted">
          Five states, and each one maps to something the system knows. Four keep the face and
          are told apart by an object; only &ldquo;Speaking&rdquo; empties the visor.
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

        <h3 className="text-lg font-medium text-ink">The transitions</h3>
        <MiaLive />
      </section>

      <section aria-labelledby="conflict-heading" className="flex flex-col gap-6">
        <h2 id="conflict-heading" className="font-display text-2xl text-ink">
          The clash
        </h2>
        <p className="max-w-prose text-ink-muted">
          Two shapes, because they are two different things: overlapping is exact arithmetic,
          and not having time carries a travel estimate inside, declared as one.
        </p>

        <div className="grid gap-6 lg:grid-cols-2">
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-medium text-ink">They overlap</h3>
            <ConflictBreakdown conflict={OVERLAP} />
          </div>
          <div className="flex flex-col gap-3">
            <h3 className="text-lg font-medium text-ink">No time</h3>
            <ConflictBreakdown conflict={NO_TIME} />
          </div>
        </div>
      </section>

      <section aria-labelledby="call-heading" className="flex flex-col gap-6">
        <h2 id="call-heading" className="font-display text-2xl text-ink">
          The call
        </h2>
        <p className="max-w-prose text-ink-muted">
          The notice whoever did not open it sees. The room has no example here: it only knows
          how to paint a real call, with its camera permissions and its open session.
        </p>

        <CallBanner who="Carlos" />
      </section>
    </main>
  );
}

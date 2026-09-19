import type { Metadata } from "next";
import { Mia } from "@/components/mia";
import { MIA_STATE_ORDER } from "@/components/mia-states";
import { MiaLive } from "./mia-live";

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
    </main>
  );
}

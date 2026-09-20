import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Home, Mic2, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SignedInPerson } from "@/lib/session";

export function AppNavigation({ person }: { person: SignedInPerson | null }) {
  return (
    <>
      <header className="presentation-header">
        <Link className="presentation-brand" href="/" aria-label="Offload, go to home">
          <Image src="/mia-still.png" alt="" width={38} height={42} />
          <span>offload<span className="presentation-brand-dot">.</span></span>
        </Link>
        <Link className="presentation-header-link" href="/offload">
          Ir a Offload
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        {/* Same account menu as the voice flow's header (see
            `OffloadHeader`): who's signed in, and the way out. This page's
            own background is already the one that menu's white card and
            `Button`'s `secondary` variant are calibrated for. */}
        {person ? (
          <details className="relative">
            <summary
              aria-label="Tu perfil"
              className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted hover:bg-white [&::-webkit-details-marker]:hidden"
            >
              <User className="size-5" aria-hidden="true" />
            </summary>

            <div className="absolute right-0 z-10 mt-2 w-72 rounded-card border border-border bg-white p-4 text-left shadow-sm">
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
        ) : null}
      </header>
      <nav className="presentation-mobile-nav" aria-label="Mobile navigation">
        <Link href="/" aria-current="page"><Home size={21} aria-hidden="true" /><span>Home</span></Link>
        <Link href="/#agenda"><CalendarDays size={21} aria-hidden="true" /><span>Calendar</span></Link>
        <Link href="/offload"><Mic2 size={21} aria-hidden="true" /><span>Offload</span></Link>
      </nav>
    </>
  );
}

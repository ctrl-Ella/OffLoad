"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Mic2, ArrowRight, User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SignedInPerson } from "@/lib/session";

/**
 * The application's chrome: the same header and mobile bar on every light
 * screen, so `/conflict` and `/call` stop drawing their own.
 */
export function AppNavigation({ person }: Readonly<{ person: SignedInPerson | null }>) {
  // Read, not hardcoded: Home carried `aria-current="page"` everywhere, which
  // only happened to be true while this rendered on one screen.
  const pathname = usePathname();
  return (
    <>
      <header className="presentation-header">
        <Link className="presentation-brand" href="/" aria-label="Offload, go to home">
          <Image src="/mia-still.png" alt="" width={38} height={42} />
          <span>offload<span className="presentation-brand-dot">.</span></span>
        </Link>
        <Link className="presentation-header-link" href="/offload">
          Go to Offload
          <ArrowRight size={16} aria-hidden="true" />
        </Link>

        {/* Same account menu as the voice flow's header (see
            `OffloadHeader`): who's signed in, and the way out. This page's
            own background is already the one that menu's white card and
            `Button`'s `secondary` variant are calibrated for. */}
        {person ? (
          <details className="relative ml-auto">
            <summary
              aria-label="Your profile"
              className="inline-flex size-11 cursor-pointer list-none items-center justify-center rounded-control text-ink-muted hover:bg-white [&::-webkit-details-marker]:hidden"
            >
              <User className="size-5" aria-hidden="true" />
            </summary>

            <div className="absolute right-0 z-10 mt-2 w-72 rounded-card border border-border bg-white p-4 text-left shadow-sm">
              <p className="text-sm font-medium text-ink">{person.name}</p>
              <p className="mt-1 text-sm text-ink-muted">
                Line ending in {person.phoneTail}, confirmed by your carrier. I remember
                you for thirty days.
              </p>
              <form action="/api/auth/logout" method="post" className="mt-3">
                <Button type="submit" variant="secondary" size="small">
                  Sign out
                </Button>
              </form>
            </div>
          </details>
        ) : null}
      </header>
      <nav className="presentation-mobile-nav" aria-label="Mobile navigation">
        <Link href="/" aria-current={pathname === "/" ? "page" : undefined}>
          <Home size={21} aria-hidden="true" />
          <span>Home</span>
        </Link>
        <Link href="/#agenda">
          <CalendarDays size={21} aria-hidden="true" />
          <span>Calendar</span>
        </Link>
        <Link href="/offload" aria-current={pathname === "/offload" ? "page" : undefined}>
          <Mic2 size={21} aria-hidden="true" />
          <span>Offload</span>
        </Link>
      </nav>
    </>
  );
}

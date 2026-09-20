"use client";

import Image from "next/image";
import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, Home, Mic2, ArrowRight } from "lucide-react";
import { AccountMenu } from "@/components/account-menu";
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
            `OffloadHeader`): who's signed in, and the way out. `ml-auto`
            here and not on the menu itself: `.presentation-header-link`
            carries its own `margin-left: auto` but disappears on mobile
            (see `presentation.css`'s breakpoint), and without this the menu
            loses the only thing pushing it to the right and lands next to
            the logo instead. */}
        {person ? (
          <div className="ml-auto">
            <AccountMenu person={person} tone="light" />
          </div>
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

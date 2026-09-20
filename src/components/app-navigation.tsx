import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Home, Mic2, ArrowRight } from "lucide-react";

export function AppNavigation() {
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
      </header>
      <nav className="presentation-mobile-nav" aria-label="Mobile navigation">
        <Link href="/" aria-current="page"><Home size={21} aria-hidden="true" /><span>Home</span></Link>
        <Link href="/#agenda"><CalendarDays size={21} aria-hidden="true" /><span>Calendar</span></Link>
        <Link href="/offload"><Mic2 size={21} aria-hidden="true" /><span>Offload</span></Link>
      </nav>
    </>
  );
}

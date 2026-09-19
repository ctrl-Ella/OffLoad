import Image from "next/image";
import Link from "next/link";
import { CalendarDays, Home, Mic2, ArrowRight } from "lucide-react";

type AppNavigationProps = { current: "home" | "brain-drop" };

export function AppNavigation({ current }: AppNavigationProps) {
  return (
    <>
      <header className="presentation-header">
        <Link className="presentation-brand" href="/" aria-label="Offload, ir al inicio">
          <Image src="/mia-still.png" alt="" width={38} height={42} />
          <span>offload<span className="presentation-brand-dot">.</span></span>
        </Link>
        <Link className="presentation-header-link" href={current === "home" ? "/brain-drop" : "/"}>
          {current === "home" ? "Ir a Brain Drop" : "Volver al inicio"}
          <ArrowRight size={16} aria-hidden="true" />
        </Link>
      </header>
      <nav className="presentation-mobile-nav" aria-label="Navegación móvil">
        <Link href="/" aria-current={current === "home" ? "page" : undefined}><Home size={21} aria-hidden="true" /><span>Inicio</span></Link>
        <Link href="/#agenda"><CalendarDays size={21} aria-hidden="true" /><span>Agenda</span></Link>
        <Link href="/brain-drop" aria-current={current === "brain-drop" ? "page" : undefined}><Mic2 size={21} aria-hidden="true" /><span>Brain Drop</span></Link>
      </nav>
    </>
  );
}

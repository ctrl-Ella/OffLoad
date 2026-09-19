import Image from "next/image";
import Link from "next/link";
import { ArrowRight, Mic2, Sparkles } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { PresentationCalendar } from "@/components/presentation-calendar";
import { TypingHeadline } from "@/components/typing-headline";

export default function HomePage() {
  const today = new Intl.DateTimeFormat("sv-SE", {
    timeZone: "Europe/Madrid",
    year: "numeric",
    month: "2-digit",
    day: "2-digit",
  }).format(new Date());

  return (
    <div className="presentation-page">
      <AppNavigation />

      <main id="main-content">
        <section className="presentation-hero" aria-labelledby="presentation-title">
          <div className="presentation-hero-copy">
            <span className="presentation-eyebrow"><span /> TU DÍA, MÁS LIGERO</span>
            <TypingHeadline />
            <div className="presentation-actions">
              <Link className="presentation-button presentation-button-primary" href="/offload"><Mic2 size={18} aria-hidden="true" /> Soltar una nota de voz</Link>
              <a className="presentation-button presentation-button-outline" href="#agenda">Ver calendario <ArrowRight size={18} aria-hidden="true" /></a>
            </div>
          </div>
          <div className="presentation-hero-art">
            <div className="presentation-orbit presentation-orbit-one" />
            <div className="presentation-orbit presentation-orbit-two" />
            <div className="presentation-mascot">
              <Image className="presentation-mascot-animated" src="/mia-blink.gif" alt="Mia, la asistente de Offload, parpadeando" width={360} height={400} unoptimized priority />
              <Image className="presentation-mascot-still" src="/mia-still.png" alt="Mia, la asistente de Offload" width={360} height={400} priority />
            </div>
            <span className="presentation-note presentation-note-top"><Sparkles size={16} aria-hidden="true" /> Hola, soy Mia</span>
          </div>
        </section>

        <PresentationCalendar today={today} />
      </main>
      <footer className="presentation-footer"><span>offload<span className="presentation-brand-dot">.</span></span><p>Más tiempo para vivirlo juntos.</p></footer>
    </div>
  );
}

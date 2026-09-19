import Image from "next/image";
import { ArrowRight, Heart, ShieldCheck, Sparkles } from "lucide-react";
import { PresentationCalendar } from "@/components/presentation-calendar";

export default function HomePage() {
  return (
    <div className="presentation-page">
      <header className="presentation-header">
        <a className="presentation-brand" href="#inicio" aria-label="Offload, volver al inicio">
          <Image src="/mia-still.png" alt="" width={38} height={42} />
          <span>offload<span className="presentation-brand-dot">.</span></span>
        </a>
        <nav aria-label="Navegación principal">
          <a href="#como-funciona">Cómo funciona</a>
          <a href="#agenda">La agenda</a>
        </nav>
        <a className="presentation-header-link" href="#agenda">Explorar agenda <ArrowRight size={16} aria-hidden="true" /></a>
      </header>

      <main id="inicio">
        <section className="presentation-hero" aria-labelledby="presentation-title">
          <div className="presentation-hero-copy">
            <span className="presentation-eyebrow"><span /> EL TIEMPO EN FAMILIA, MEJOR COORDINADO</span>
            <h1 id="presentation-title">Menos carga mental.<br /><em>Más tiempo para vivir.</em></h1>
            <p>Offload reúne los planes de tu familia, ayuda a resolver los imprevistos y deja espacio para lo que también importa: tú.</p>
            <div className="presentation-actions">
              <a className="presentation-button presentation-button-primary" href="#agenda">Descubre vuestra agenda <ArrowRight size={18} aria-hidden="true" /></a>
              <a className="presentation-button presentation-button-outline" href="#como-funciona">Conoce a Mia</a>
            </div>
            <p className="presentation-reassurance"><ShieldCheck size={17} aria-hidden="true" /> Las decisiones que cambian el plan de alguien siempre se confirman.</p>
          </div>
          <div className="presentation-hero-art">
            <div className="presentation-orbit presentation-orbit-one" />
            <div className="presentation-orbit presentation-orbit-two" />
            <div className="presentation-mascot">
              <Image className="presentation-mascot-animated" src="/mia-blink.gif" alt="Mia, la asistente de Offload, parpadeando" width={360} height={400} unoptimized priority />
              <Image className="presentation-mascot-still" src="/mia-still.png" alt="Mia, la asistente de Offload" width={360} height={400} priority />
            </div>
            <span className="presentation-note presentation-note-top"><Sparkles size={16} aria-hidden="true" /> Hola, soy Mia</span>
            <span className="presentation-note presentation-note-bottom"><Heart size={16} aria-hidden="true" /> Tu tiempo también cuenta</span>
          </div>
        </section>

        <section id="como-funciona" className="presentation-intro" aria-labelledby="presentation-intro-title">
          <div>
            <span className="presentation-section-label">UNA FORMA MÁS LIGERA DE ORGANIZARSE</span>
            <h2 id="presentation-intro-title">La familia comparte los planes.<br />Mia ayuda a conectarlos.</h2>
          </div>
          <p>Una agenda clara para ver el día de todos. Cuando surge un conflicto, Mia prepara opciones y pregunta antes de cambiar el plan de otra persona.</p>
        </section>

        <PresentationCalendar />

        <section className="presentation-ending" aria-label="Bienestar personal">
          <span className="presentation-ending-icon"><Heart size={24} aria-hidden="true" /></span>
          <div><h2>Y cuando todo encaja, apareces tú.</h2><p>Un paseo, un libro, un momento de calma. Tu bienestar también merece un lugar en la agenda.</p></div>
          <a href="#agenda">Volver a la agenda <ArrowRight size={17} aria-hidden="true" /></a>
        </section>
      </main>
      <footer className="presentation-footer"><span>offload<span className="presentation-brand-dot">.</span></span><p>Más tiempo para vivirlo juntos.</p></footer>
    </div>
  );
}

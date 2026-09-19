import { ArrowRight, CalendarDays, Check, Clock3, Heart, ShieldCheck, Sparkles, Video } from "lucide-react";
import { MascotLogo } from "./mascot-logo";

const events = [
  { time: "09:00", title: "Desayuno en familia", detail: "Un comienzo sin prisas", tone: "mint" },
  { time: "11:30", title: "Partido de Nicolás", detail: "Carlos · Polideportivo", tone: "peach" },
  { time: "17:00", title: "Recoger a Nicolás", detail: "Pendiente de coordinar", tone: "sand" },
] as const;

const benefits = [
  { icon: CalendarDays, title: "Planes a la vista", description: "Una agenda compartida para entender el día de un vistazo." },
  { icon: Sparkles, title: "Menos decisiones", description: "Mia reúne las opciones antes de pedirte una respuesta." },
  { icon: Heart, title: "Espacio para ti", description: "Tu bienestar forma parte del plan familiar." },
] as const;

type HomeScreenProps = { onCall: () => void; onSummary: () => void };

export function HomeScreen({ onCall, onSummary }: HomeScreenProps) {
  return (
    <>
      <main id="inicio" className="home-main">
        <section className="hero" aria-labelledby="hero-title">
          <div className="hero-copy">
            <span className="eyebrow"><span className="eyebrow-line" /> MÁS CALMA EN CADA DÍA</span>
            <h1 id="hero-title">La vida en familia pesa menos <em>juntos.</em></h1>
            <p>Offload te ayuda a coordinar los imprevistos, compartir las decisiones y recuperar tiempo para lo que te hace bien.</p>
            <div className="hero-actions">
              <button className="button button-primary" onClick={onCall}>Resolver un imprevisto <ArrowRight size={18} /></button>
              <a className="button button-secondary" href="#como-funciona">Descubre cómo funciona</a>
            </div>
            <div className="hero-trust"><span><ShieldCheck size={17} /> Tú confirmas cada cambio</span><span><Clock3 size={17} /> Tu tiempo cuenta</span></div>
          </div>
          <div className="hero-visual">
            <div className="hero-halo" />
            <div className="orbit orbit-one" /><div className="orbit orbit-two" />
            <span className="floating-tag tag-top"><Sparkles size={14} /> Hola, soy Mia</span>
            <MascotLogo className="hero-mascot" />
            <span className="floating-tag tag-bottom"><Heart size={15} /> Aquí tienes un poco de aire</span>
          </div>
        </section>

        <section id="como-funciona" className="benefits" aria-label="Cómo te ayuda Offload">
          {benefits.map(({ icon: Icon, title, description }) => (
            <article className="benefit" key={title}><span className="benefit-icon"><Icon size={22} /></span><h2>{title}</h2><p>{description}</p></article>
          ))}
        </section>

        <section className="today-section" aria-labelledby="today-title">
          <div className="section-intro"><div><span className="eyebrow"><span className="eyebrow-line" /> UNA MIRADA A VUESTRO DÍA</span><h2 id="today-title">Todo en su sitio. Tú también.</h2><p>Así podría verse un día familiar organizado con Offload.</p></div><span className="demo-label">EJEMPLO DEL PRODUCTO</span></div>
          <div className="today-grid">
            <div className="agenda-card surface"><div className="card-heading"><div><span className="card-kicker">AGENDA FAMILIAR</span><h3>Lo que viene hoy</h3></div><CalendarDays size={22} /></div><div className="event-list">{events.map(event => <div className="event" key={event.time}><time>{event.time}</time><div className={`event-detail ${event.tone}`}><strong>{event.title}</strong><span>{event.detail}</span></div></div>)}</div><div className="agenda-footer"><span><span className="legend-dot" /> Elvia y Carlos</span><span>Un plan que podéis compartir</span></div></div>
            <div className="decision-card"><span className="decision-icon"><Video size={21} /></span><span className="card-kicker">CUANDO SURGE UN IMPREVISTO</span><h3>La solución empieza hablando.</h3><p>Si un cambio afecta a otra persona, reuníos en una llamada. Mia escucha en silencio y ayuda cuando le dais la palabra.</p><div className="decision-note"><Check size={18} /><span>La disponibilidad de la red de apoyo se pregunta y se confirma.</span></div><button className="button button-aqua" onClick={onCall}>Abrir una llamada <ArrowRight size={18} /></button></div>
          </div>
        </section>

        <section className="wellbeing-strip"><div><span className="eyebrow">TU BIENESTAR TAMBIÉN VA EN LA AGENDA</span><h2>Cuando todo encaja, aparece tiempo para ti.</h2><p>Leer, pasear, tomar un café. Pequeños momentos que también merecen un lugar.</p></div><button className="button button-dark" onClick={onSummary}>Ver un ejemplo <ArrowRight size={18} /></button></section>
      </main>
      <footer className="site-footer"><span>offload<span className="brand-dot">.</span></span><p>Más tiempo para vivirlo juntos.</p></footer>
    </>
  );
}

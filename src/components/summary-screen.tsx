"use client";

import { ArrowLeft, ArrowRight, BookOpen, Check, Clock3, Heart, ShieldCheck } from "lucide-react";
import { useState } from "react";

type SummaryScreenProps = { confirmed: boolean; onBack: () => void; onHome: () => void };

export function SummaryScreen({ confirmed, onBack, onHome }: SummaryScreenProps) {
  const [saved, setSaved] = useState(false);

  return (
    <main className="summary-page">
      <div className="summary-container"><button className="back-button" onClick={onBack}><ArrowLeft size={17} /> Volver</button>
        <div className="summary-grid"><div className="summary-story"><span className="eyebrow"><span className="eyebrow-line" /> TU TIEMPO TAMBIÉN IMPORTA</span><span className="summary-check"><Check size={27} /></span><h1>{confirmed ? "Un acuerdo menos en tu cabeza." : "Imagina un poco más de aire."}</h1><p>Cuando un imprevisto se coordina, puede aparecer un hueco para ti. Este ejemplo muestra cómo Offload lo haría visible.</p><div className="time-figure"><span>+</span>30 <small>min</small></div><p className="time-caption"><Clock3 size={16} /> Tiempo potencial de ejemplo, pendiente de calcular con agendas reales.</p><div className="summary-facts surface"><h2>Así se resuelve</h2><div><span className="fact-icon"><Check size={17} /></span><p><strong>Primero, un acuerdo</strong><small>La persona que ayuda confirma que puede hacerlo.</small></p></div><div><span className="fact-icon"><ShieldCheck size={17} /></span><p><strong>Después, la agenda</strong><small>Los cambios se guardan solo con confirmación humana.</small></p></div></div></div>
          <aside className="activity-card"><span className="activity-heart"><Heart size={22} fill="currentColor" /></span><span className="card-kicker">UN MOMENTO PARA TI</span><h2>¿Qué harías con media hora?</h2><p>Una idea basada en el tiempo que podría quedar libre cuando el plan esté cerrado.</p><div className="activity-option"><span><BookOpen size={23} /></span><div><strong>Un café y tu libro</strong><small>Una pausa de 30 minutos</small></div></div><button className="button button-aqua" onClick={() => setSaved(!saved)}>{saved ? <Check size={18} /> : <Heart size={18} />}{saved ? "Idea guardada" : "Guardar esta idea"}</button><button className="plain-link" onClick={onHome}>Volver a inicio <ArrowRight size={17} /></button></aside></div>
      </div>
    </main>
  );
}

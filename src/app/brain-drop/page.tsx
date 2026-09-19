import Image from "next/image";
import { AppNavigation } from "@/components/app-navigation";
import { BrainDropRecorder } from "@/components/brain-drop-recorder";

export const metadata = {
  title: "Brain Drop · Offload",
  description: "Graba una nota de voz y saca de la cabeza lo que no quieres olvidar.",
};

export default function BrainDropPage() {
  return (
    <div className="presentation-page brain-drop-page">
      <AppNavigation current="brain-drop" />
      <main id="main-content" className="brain-drop-main">
        <div className="brain-drop-heading"><span className="presentation-section-label">UN ESPACIO PARA SOLTARLO</span><h1>Brain Drop<span className="presentation-brand-dot">.</span></h1><p>Cuéntaselo a Mia. No tienes que llevarlo todo en la cabeza.</p></div>
        <div className="brain-drop-grid"><BrainDropRecorder /><aside className="brain-drop-aside"><Image className="brain-drop-mascot-animated" src="/mia-blink.gif" alt="Mia escucha" width={230} height={256} unoptimized /><Image className="brain-drop-mascot-still" src="/mia-still.png" alt="Mia escucha" width={230} height={256} /><p>Una idea menos dando vueltas.</p></aside></div>
      </main>
    </div>
  );
}

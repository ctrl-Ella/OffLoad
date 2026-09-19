"use client";

import { useEffect, useState } from "react";
import { ArrowRight, Heart, Home, Video } from "lucide-react";
import { HomeScreen } from "@/components/home-screen";
import { MascotLogo } from "@/components/mascot-logo";
import { SummaryScreen } from "@/components/summary-screen";
import { VideoExperience } from "@/components/video-experience";

type Screen = "home" | "call" | "summary";

export default function AppPage() {
  const [screen, setScreen] = useState<Screen>("home");
  const [confirmed, setConfirmed] = useState(false);

  useEffect(() => {
    if (new URLSearchParams(window.location.search).has("room")) {
      queueMicrotask(() => setScreen("call"));
    }
  }, []);

  function navigate(next: Screen) {
    if (next !== "call") {
      const url = new URL(window.location.href);
      url.searchParams.delete("room");
      window.history.replaceState(null, "", url);
    }
    setScreen(next);
    window.scrollTo({ top: 0, behavior: "instant" });
  }

  if (screen === "call") {
    return <VideoExperience onDone={() => { setConfirmed(true); navigate("summary"); }} onExit={() => navigate("home")} />;
  }

  return (
    <div className="site-shell">
      <header className="site-header"><div className="header-inner">
        <button className="wordmark" onClick={() => navigate("home")} aria-label="Offload, ir al inicio"><MascotLogo className="brand-mascot" decorative /> <span>offload<span className="brand-dot">.</span></span></button>
        <nav className="desktop-nav" aria-label="Navegación principal"><button onClick={() => navigate("home")} aria-current={screen === "home" ? "page" : undefined}>Inicio</button><button onClick={() => { navigate("home"); requestAnimationFrame(() => document.getElementById("como-funciona")?.scrollIntoView()); }}>Cómo funciona</button><button onClick={() => navigate("summary")} aria-current={screen === "summary" ? "page" : undefined}>Bienestar</button></nav>
        <button className="header-cta" onClick={() => navigate("call")}>Abrir llamada <ArrowRight size={16} /></button>
      </div></header>
      {screen === "home" ? <HomeScreen onCall={() => navigate("call")} onSummary={() => navigate("summary")} /> : <SummaryScreen confirmed={confirmed} onBack={() => navigate("call")} onHome={() => navigate("home")} />}
      <nav className="mobile-nav" aria-label="Navegación móvil"><button onClick={() => navigate("home")} aria-current={screen === "home" ? "page" : undefined}><Home size={20} /><span>Inicio</span></button><button onClick={() => navigate("call")}><Video size={20} /><span>Llamada</span></button><button onClick={() => navigate("summary")} aria-current={screen === "summary" ? "page" : undefined}><Heart size={20} /><span>Para ti</span></button></nav>
    </div>
  );
}

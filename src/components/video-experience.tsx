"use client";

import { useState } from "react";
import { ArrowLeft, Check, Copy, Mic, MicOff, PhoneOff, Sparkles, Video, VideoOff } from "lucide-react";
import { useVideoRoom } from "@/hooks/use-video-room";

type VideoExperienceProps = {
  onDone: () => void;
  onExit: () => void;
};

export function VideoExperience({ onDone, onExit }: VideoExperienceProps) {
  const { localHostRef, remoteHostRef, status, error, ticket, remoteCount, microphoneOn, cameraOn, invited, connect, invite, toggleMicrophone, toggleCamera } = useVideoRoom();
  const [miaHasTurn, setMiaHasTurn] = useState(false);
  const [confirmOpen, setConfirmOpen] = useState(false);

  return (
    <main className="call-page">
      <div className="call-shell">
        <header className="call-header">
          <button onClick={onExit} aria-label="Salir de la llamada"><ArrowLeft size={20} /></button>
          <div><strong>Coordinación familiar</strong><span>{status === "connected" ? "Llamada en curso" : "Una sala para encontrar un plan"}</span></div>
          <span className="call-live">● VONAGE</span>
        </header>
        <div className="video-grid">
          <div className="video-tile local-tile"><div className="video-host" ref={localHostRef} /><span className="tile-label">TÚ</span></div>
          <div className="video-tile remote-tile"><div className="video-host remote-host" ref={remoteHostRef} />{remoteCount === 0 && <div className="tile-placeholder"><Video size={22} /><strong>Esperando a alguien</strong><small>Comparte el enlace de la sala</small></div>}<span className="tile-label">FAMILIA</span></div>
          <div className="video-tile invite-tile"><button onClick={() => void invite()} disabled={!ticket}><Copy size={23} /><strong>{invited ? "Enlace compartido" : "Invitar a alguien"}</strong><small>Su disponibilidad está por confirmar</small></button><span className="tile-label">RED DE APOYO</span></div>
          <div className="video-tile mia-tile"><span className="mia-idle">● EN SILENCIO</span><div className="mia-symbol">✳</div><span className="tile-label">MIA</span></div>
        </div>
        {status !== "connected" && <div className="connect-panel"><h1>Hablemos y encontremos un plan.</h1><p>Activa tu cámara y micrófono para entrar en la sala.</p><button className="button button-aqua" onClick={() => void connect()} disabled={status === "connecting"}>{status === "connecting" ? "Conectando…" : "Entrar en la llamada"}</button></div>}
        <div className="call-proposal"><span className="proposal-mark"><Sparkles size={20} /></span><div><strong>Mia está {miaHasTurn ? "contigo" : "en silencio"}</strong><p>{miaHasTurn ? "Hablad de las opciones y confirmad con la persona que vaya a ayudar." : "Espera a que le deis la palabra para proponer una opción."}</p></div><button onClick={() => setMiaHasTurn(true)} disabled={status !== "connected" || miaHasTurn}>{miaHasTurn ? "Escuchando" : "Darle paso"}</button></div>
        {error && <p className="call-error" role="alert">{error}</p>}
        <div className="call-controls"><button onClick={toggleMicrophone} disabled={status !== "connected"} aria-label={microphoneOn ? "Silenciar micrófono" : "Activar micrófono"}>{microphoneOn ? <Mic size={21} /> : <MicOff size={21} />}</button><button onClick={toggleCamera} disabled={status !== "connected"} aria-label={cameraOn ? "Apagar cámara" : "Activar cámara"}>{cameraOn ? <Video size={21} /> : <VideoOff size={21} />}</button><button onClick={() => setConfirmOpen(true)} disabled={status !== "connected"} aria-label="Confirmar acuerdo"><Check size={21} /></button><button className="hangup" onClick={onExit} aria-label="Salir de la llamada"><PhoneOff size={21} /></button></div>
        <button className="call-finish" onClick={() => setConfirmOpen(true)} disabled={status !== "connected"}>Confirmar acuerdo y ver resumen</button>
      </div>
      {confirmOpen && <div className="modal-backdrop"><div className="confirm-modal" role="dialog" aria-modal="true" aria-labelledby="confirm-title"><h2 id="confirm-title">¿Habéis confirmado el acuerdo?</h2><p>Comprueba que la persona que ayudará ha aceptado. El calendario todavía no se modifica automáticamente.</p><button className="button button-primary" onClick={onDone}>Sí, está confirmado</button><button className="button button-secondary" onClick={() => setConfirmOpen(false)}>Aún no</button></div></div>}
    </main>
  );
}

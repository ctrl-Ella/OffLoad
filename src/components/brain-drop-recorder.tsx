"use client";

import { useEffect, useRef, useState } from "react";
import { Download, Mic, Square, Trash2 } from "lucide-react";
import { listVoiceNotes, removeVoiceNote, saveVoiceNote, type VoiceNote } from "@/lib/voice-notes";

type NoteWithUrl = VoiceNote & { url: string };
type RecorderStatus = "idle" | "recording" | "saving";

function formatDuration(seconds: number) {
  return `${Math.floor(seconds / 60).toString().padStart(2, "0")}:${(seconds % 60).toString().padStart(2, "0")}`;
}

export function BrainDropRecorder() {
  const recorderRef = useRef<MediaRecorder | null>(null);
  const streamRef = useRef<MediaStream | null>(null);
  const startedAtRef = useRef(0);
  const urlsRef = useRef<string[]>([]);
  const mountedRef = useRef(true);
  const [status, setStatus] = useState<RecorderStatus>("idle");
  const [elapsed, setElapsed] = useState(0);
  const [notes, setNotes] = useState<NoteWithUrl[]>([]);
  const [error, setError] = useState("");

  useEffect(() => {
    let active = true;
    mountedRef.current = true;
    const urls = urlsRef.current;
    void listVoiceNotes().then(saved => {
      if (!active) return;
      const loaded = saved.map(note => ({ ...note, url: URL.createObjectURL(note.audio) }));
      urls.push(...loaded.map(note => note.url));
      setNotes(current => [...current, ...loaded.filter(note => !current.some(existing => existing.id === note.id))]);
    }).catch(() => { if (active) setError("No se pudieron cargar las notas guardadas en este navegador."); });
    return () => {
      active = false;
      mountedRef.current = false;
      recorderRef.current?.stop();
      streamRef.current?.getTracks().forEach(track => track.stop());
      urls.forEach(url => URL.revokeObjectURL(url));
    };
  }, []);

  useEffect(() => {
    if (status !== "recording") return;
    const timer = window.setInterval(() => setElapsed(Math.floor((Date.now() - startedAtRef.current) / 1000)), 250);
    return () => window.clearInterval(timer);
  }, [status]);

  async function startRecording() {
    if (status !== "idle") return;
    setError("");
    if (!navigator.mediaDevices?.getUserMedia || !window.MediaRecorder) {
      setError("Este navegador no permite grabar audio. Prueba con uno actualizado y una conexión segura.");
      return;
    }
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ audio: true });
      if (!mountedRef.current) { stream.getTracks().forEach(track => track.stop()); return; }
      const mimeType = ["audio/webm;codecs=opus", "audio/mp4", "audio/webm"].find(type => MediaRecorder.isTypeSupported(type));
      const recorder = new MediaRecorder(stream, mimeType ? { mimeType } : undefined);
      const chunks: Blob[] = [];
      streamRef.current = stream;
      recorderRef.current = recorder;
      recorder.ondataavailable = event => { if (event.data.size > 0) chunks.push(event.data); };
      recorder.onstop = () => {
        stream.getTracks().forEach(track => track.stop());
        streamRef.current = null;
        recorderRef.current = null;
        const audio = new Blob(chunks, { type: recorder.mimeType || chunks[0]?.type || "audio/webm" });
        if (audio.size === 0) { if (mountedRef.current) { setError("La grabación quedó vacía. Inténtalo de nuevo."); setStatus("idle"); } return; }
        const note: VoiceNote = { id: crypto.randomUUID(), createdAt: new Date().toISOString(), durationSeconds: Math.max(1, Math.round((Date.now() - startedAtRef.current) / 1000)), audio };
        if (mountedRef.current) {
          const url = URL.createObjectURL(audio);
          urlsRef.current.push(url);
          setNotes(current => [{ ...note, url }, ...current]);
          setStatus("idle");
        }
        void saveVoiceNote(note).catch(() => { if (mountedRef.current) setError("La nota se puede escuchar ahora, pero no se pudo guardar en este navegador. Descárgala antes de salir."); });
      };
      recorder.onerror = () => { setError("La grabación se interrumpió. Inténtalo de nuevo."); recorder.stop(); };
      recorder.start();
      startedAtRef.current = Date.now();
      setElapsed(0);
      setStatus("recording");
    } catch {
      streamRef.current?.getTracks().forEach(track => track.stop());
      setError("No se pudo acceder al micrófono. Comprueba los permisos del navegador.");
      setStatus("idle");
    }
  }

  function stopRecording() {
    if (status !== "recording" || recorderRef.current?.state !== "recording") return;
    setStatus("saving");
    recorderRef.current.stop();
  }

  async function deleteNote(id: string) {
    try {
      await removeVoiceNote(id);
      setNotes(current => {
        const removed = current.find(note => note.id === id);
        if (removed) URL.revokeObjectURL(removed.url);
        return current.filter(note => note.id !== id);
      });
    } catch {
      setError("No se pudo eliminar la nota. Inténtalo de nuevo.");
    }
  }

  return (
    <div className="brain-drop-recorder">
      <div className="brain-drop-record-card">
        <div className={`brain-drop-mic ${status === "recording" ? "is-recording" : ""}`}><Mic size={37} aria-hidden="true" /></div>
        <span className="brain-drop-state" role="status">{status === "recording" ? "GRABANDO" : status === "saving" ? "GUARDANDO" : "LISTA PARA ESCUCHARTE"}</span>
        <h2>{status === "recording" ? "Te escucho." : "Suelta lo que tienes en mente."}</h2>
        <p>Di tu idea, tu pendiente o eso que no quieres olvidar.</p>
        <div className="brain-drop-timer" aria-label={`Duración ${formatDuration(elapsed)}`}>{formatDuration(elapsed)}</div>
        {status === "recording" ? <button className="brain-drop-record-button is-stop" type="button" onClick={stopRecording}><Square size={18} fill="currentColor" aria-hidden="true" /> Terminar nota</button> : <button className="brain-drop-record-button" type="button" onClick={() => void startRecording()} disabled={status === "saving"}><Mic size={20} aria-hidden="true" /> Grabar nota</button>}
        <small>Solo se activa el micrófono cuando pulsas grabar.</small>
      </div>
      {error && <p className="brain-drop-error" role="alert">{error}</p>}
      <section className="brain-drop-notes" aria-labelledby="brain-drop-notes-title">
        <div className="brain-drop-notes-heading"><h2 id="brain-drop-notes-title">Tus notas de voz</h2><span>{notes.length}</span></div>
        {notes.length === 0 ? <p className="brain-drop-empty">Todavía no hay notas. Graba la primera cuando quieras.</p> : <ul>{notes.map(note => <li key={note.id}><div><strong>Nota del {new Intl.DateTimeFormat("es-ES", { dateStyle: "medium", timeStyle: "short" }).format(new Date(note.createdAt))}</strong><span>{formatDuration(note.durationSeconds)}</span></div><audio controls src={note.url} preload="none" aria-label={`Reproducir nota del ${new Date(note.createdAt).toLocaleDateString("es-ES")}`} /><div className="brain-drop-note-actions"><a href={note.url} download={`offload-nota-${note.createdAt.slice(0, 10)}.${note.audio.type.includes("mp4") ? "m4a" : "webm"}`}><Download size={16} aria-hidden="true" /> Descargar</a><button type="button" onClick={() => void deleteNote(note.id)}><Trash2 size={16} aria-hidden="true" /> Eliminar</button></div></li>)}</ul>}
        <p className="brain-drop-privacy">Tus grabaciones se guardan solo en este navegador. Puedes escucharlas, descargarlas o eliminarlas aquí.</p>
      </section>
    </div>
  );
}

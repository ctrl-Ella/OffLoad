"use client";

import { useCallback, useEffect, useRef, useState } from "react";
import type OT from "@vonage/client-sdk-video";

type RoomCredentials = {
  applicationId: string;
  sessionId: string;
  token: string;
  ticket: string;
};

type RoomStatus = "idle" | "connecting" | "connected";

export function useVideoRoom() {
  const localHost = useRef<HTMLDivElement>(null);
  const remoteHost = useRef<HTMLDivElement>(null);
  const session = useRef<OT.Session | null>(null);
  const publisher = useRef<OT.Publisher | null>(null);
  const [status, setStatus] = useState<RoomStatus>("idle");
  const [error, setError] = useState("");
  const [ticket, setTicket] = useState("");
  const [remoteCount, setRemoteCount] = useState(0);
  const [microphoneOn, setMicrophoneOn] = useState(true);
  const [cameraOn, setCameraOn] = useState(true);
  const [invited, setInvited] = useState(false);
  const localHostRef = useCallback((node: HTMLDivElement | null) => { localHost.current = node; }, []);
  const remoteHostRef = useCallback((node: HTMLDivElement | null) => { remoteHost.current = node; }, []);

  useEffect(() => () => {
    publisher.current?.destroy();
    void session.current?.disconnect();
  }, []);

  async function connect() {
    if (status !== "idle") return;
    setStatus("connecting");
    setError("");

    try {
      const inviteTicket = new URLSearchParams(window.location.search).get("room");
      const response = await fetch("/api/video/room", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ ticket: inviteTicket || undefined, name: inviteTicket ? "Invitado" : "Elvia" }),
      });
      const result: RoomCredentials & { error?: string } = await response.json();
      if (!response.ok) throw new Error(result.error || "No se pudo abrir la llamada.");
      setTicket(result.ticket);

      const { default: sdk } = await import("@vonage/client-sdk-video");
      if (!localHost.current || !remoteHost.current) throw new Error("La sala todavía no está disponible.");
      const activeSession = sdk.initSession(result.applicationId, result.sessionId);
      session.current = activeSession;

      activeSession.on("streamCreated", event => {
        const host = remoteHost.current;
        if (!host) return;
        const tile = document.createElement("div");
        tile.className = "remote-video";
        tile.dataset.streamId = event.stream.streamId;
        host.appendChild(tile);
        activeSession.subscribe(event.stream, tile, { width: "100%", height: "100%" });
        setRemoteCount(host.children.length);
      });
      activeSession.on("streamDestroyed", event => {
        remoteHost.current?.querySelector(`[data-stream-id="${CSS.escape(event.stream.streamId)}"]`)?.remove();
        setRemoteCount(remoteHost.current?.children.length || 0);
      });

      await activeSession.connect.promise(result.token);
      const activePublisher = await sdk.initPublisher.promise(localHost.current, {
        width: "100%",
        height: "100%",
        name: inviteTicket ? "Invitado" : "Elvia",
        publishAudio: true,
        publishVideo: true,
      });
      publisher.current = activePublisher;
      await activeSession.publish.promise(activePublisher);
      setStatus("connected");
    } catch (cause) {
      publisher.current?.destroy();
      void session.current?.disconnect();
      publisher.current = null;
      session.current = null;
      setError(cause instanceof Error ? cause.message : "No se pudo conectar la llamada.");
      setStatus("idle");
    }
  }

  async function invite() {
    if (!ticket) return;
    const url = new URL(window.location.pathname, window.location.origin);
    url.searchParams.set("room", ticket);
    try {
      if (navigator.share) {
        await navigator.share({ title: "Llamada familiar de Offload", url: url.toString() });
      } else {
        await navigator.clipboard.writeText(url.toString());
      }
      setInvited(true);
    } catch (cause) {
      if (cause instanceof DOMException && cause.name === "AbortError") return;
      setError("No se pudo compartir el enlace. Comprueba los permisos del navegador.");
    }
  }

  function toggleMicrophone() {
    publisher.current?.publishAudio(!microphoneOn);
    setMicrophoneOn(value => !value);
  }

  function toggleCamera() {
    publisher.current?.publishVideo(!cameraOn);
    setCameraOn(value => !value);
  }

  return {
    localHostRef, remoteHostRef, status, error, ticket, remoteCount, microphoneOn, cameraOn, invited,
    connect, invite, toggleMicrophone, toggleCamera,
  };
}

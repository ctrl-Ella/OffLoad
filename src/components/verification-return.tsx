"use client";

import { useEffect, useRef, useState } from "react";
import Link from "next/link";
import { Notice } from "@/components/ui/notice";
import { forgetAttemptInBrowser, pendingAttempt } from "@/lib/browser-attempt";
import { fetchWithTimeout } from "@/lib/fetch-with-timeout";

/**
 * Where the carrier sends the browser back, and the only place the silent code
 * can be read: Vonage returns it in the URL **fragment**, and a fragment never
 * reaches the server. Which is good — it stays out of access logs, out of the
 * proxy's history and out of the Referer.
 */

type Outcome =
  | { state: "checking" }
  | { state: "in"; name: string }
  | { state: "not-family"; tail: string }
  | { state: "failed" };

export function VerificationReturn() {
  const [outcome, setOutcome] = useState<Outcome>({ state: "checking" });
  const [showChecking, setShowChecking] = useState(false);

  // React runs effects twice in development. Without this the first pass read
  // the fragment, cleared it, and the second decided there was no result and
  // painted that over a working sign-in.
  const started = useRef(false);

  useEffect(() => {
    if (started.current) return;
    started.current = true;

    // Set once this effect's own instance stops being the current one — on
    // unmount, if whoever is on this screen navigates away while the fetch
    // below is still in flight. Every `setOutcome` after an `await` checks
    // it first: without this, a state update lands on a component that's
    // already gone.
    let cancelled = false;

    const fromFragment = new URLSearchParams(window.location.hash.slice(1));
    const code = fromFragment.get("code") ?? new URLSearchParams(window.location.search).get("code");
    const requestId = pendingAttempt();

    // Single use: out of the history as soon as it is read.
    if (window.location.hash) {
      window.history.replaceState(null, "", window.location.pathname);
    }

    // Arriving with no fragment is not a failure, it is an old address — a
    // phone browser reopening its last tab. The home page is the only one that
    // knows whether there is a session.
    if (!code || !requestId) {
      window.location.replace("/");
      return;
    }

    void (async () => {
      try {
        const response = await fetchWithTimeout("/api/verification/check", {
          method: "POST",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ requestId, code, channel: "silent_auth" }),
        });

        if (!response.ok) {
          if (!cancelled) setOutcome({ state: "failed" });
          return;
        }

        const data = (await response.json()) as {
          status: string;
          phoneTail?: string;
          person?: { name: string } | null;
        };

        if (data.status !== "completed" || !data.phoneTail) {
          // The attempt is NOT forgotten here: the carrier said no, so the
          // fallback SMS is alive and the code screen still needs it.
          if (!cancelled) setOutcome({ state: "failed" });
          return;
        }

        forgetAttemptInBrowser();

        if (!data.person) {
          if (!cancelled) setOutcome({ state: "not-family", tail: data.phoneTail });
          return;
        }

        if (!cancelled) setOutcome({ state: "in", name: data.person.name });

        // A full load, not router.replace: Next keeps the RSC payload of
        // visited routes in the browser, and the home page is already in there
        // as it looked before signing in. A client navigation serves that copy
        // and paints the door again with the session cookie already set.
        // `replace` so "back" does not land here with a spent code.
        window.location.replace("/");
      } catch {
        if (!cancelled) setOutcome({ state: "failed" });
      }
    })();

    return () => {
      cancelled = true;
    };
  }, []);

  // 400ms before saying anything: on the way out this is never seen, and a
  // real check takes over a second so it still shows.
  useEffect(() => {
    const timer = setTimeout(() => setShowChecking(true), 400);
    return () => clearTimeout(timer);
  }, []);

  return (
    <div aria-live="polite" className="flex flex-col gap-4">
      {outcome.state === "checking" && showChecking ? (
        <Notice tone="good" title="Confirmando tu línea">
          <p>Un segundo.</p>
        </Notice>
      ) : null}

      {outcome.state === "in" ? (
        <Notice tone="good" title={`Hola, ${outcome.name}`}>
          <p>Ya estás dentro.</p>
        </Notice>
      ) : null}

      {outcome.state === "not-family" ? (
        <Notice tone="alert" title="Línea confirmada">
          <p>
            El teléfono acabado en {outcome.tail} es tuyo, pero no está en esta
            casa. Que te añada alguien de la familia y vuelve a entrar.
          </p>
        </Notice>
      ) : null}

      {outcome.state === "failed" ? (
        <Notice tone="alert" title="Tu operador no ha podido confirmar la línea">
          <p>
            Puede que el wifi siguiera encendido. Vuelve a escribir tu número y
            te llevo a la pantalla del código, o entra con Google.
          </p>
          <p className="mt-3">
            <Link href="/" className="font-medium underline">
              Volver a la portada
            </Link>
          </p>
        </Notice>
      ) : null}
    </div>
  );
}

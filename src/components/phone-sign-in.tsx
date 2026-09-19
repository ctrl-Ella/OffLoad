"use client";

import type { ReactNode } from "react";
import { useEffect, useState, useSyncExternalStore } from "react";
import { useRouter } from "next/navigation";
import { Smartphone } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Field } from "@/components/ui/field";
import { Notice } from "@/components/ui/notice";
import {
  forgetAttemptInBrowser,
  pendingAttempt,
  rememberAttemptInBrowser,
} from "@/lib/browser-attempt";

/**
 * Asks for the phone number and carries the verification to the end, both ways.
 *
 * If the carrier can confirm the line, the browser jumps to the URL Vonage
 * returns. A full navigation and not a fetch: only that way does the request
 * leave through whichever interface the system has active.
 */

/** E.164 without the `+`. The same thing the server validates. */
const PHONE_FORMAT = /^[1-9]\d{7,14}$/;

/**
 * A failure is not announced the same way depending on whose it is. Marking
 * the field sets `aria-invalid`, which a screen reader reads as "your number
 * is wrong" — a lie when the service is what failed.
 */
type Failure = { scope: "number" | "code" | "service"; message: string };

/** `door` exists so the screen opens with one decision rather than a form. */
type Phase =
  | { step: "door" }
  | { step: "phone" }
  | { step: "code"; requestId: string }
  | { step: "inside"; name: string | null; tail: string };

const DID_NOT_START =
  "No he podido empezar la comprobación. Vuelve a intentarlo en un momento.";
const NO_CONNECTION = "No he podido conectar. Vuelve a intentarlo en un momento.";
const NOT_CONFIGURED =
  "Todavía no puedo comprobar tu línea. No es cosa tuya ni del número.";
const BAD_CODE = "Ese código no vale. Mira el SMS otra vez.";

type Props = {
  /** The other way in, passed as a slot: this component knows about phones and
   *  about Vonage, and has no business knowing Google exists. Only shown at the
   *  door — offering a different route mid-check invites abandoning it. */
  alternative?: ReactNode;
};

export function PhoneSignIn({ alternative }: Props) {
  const router = useRouter();
  const [phone, setPhone] = useState("");
  const [code, setCode] = useState("");
  const [phase, setPhase] = useState<Phase>({ step: "door" });
  const [failure, setFailure] = useState<Failure | null>(null);
  const [busy, setBusy] = useState(false);

  const normalised = phone.replace(/[\s+]/g, "");

  /**
   * Coming back with "back" after signing in showed this screen again: the
   * browser restores the page from its cache exactly as it was before the jump
   * to the carrier, without asking the server, and the server is the only one
   * that knows there is a session now.
   */
  useEffect(() => {
    function onRestore(event: PageTransitionEvent) {
      if (event.persisted) window.location.reload();
    }

    window.addEventListener("pageshow", onRestore);
    return () => window.removeEventListener("pageshow", onRestore);
  }, []);

  // useSyncExternalStore and not an effect that sets state: the server has no
  // sessionStorage, so it returns null and React reconciles on hydration
  // without leaving a screen that flickers.
  const pending = useSyncExternalStore(
    () => () => {},
    pendingAttempt,
    () => null,
  );

  /**
   * Leaving the code screen without waiting for the attempt to expire. With a
   * virtual number the SMS never arrives, and whoever mistyped their number was
   * stuck for ten minutes unable to enter the right one.
   */
  function startWithAnotherNumber() {
    forgetAttemptInBrowser();
    setCode("");
    setFailure(null);
    setPhase({ step: "phone" });
  }

  async function askForVerification() {
    if (!PHONE_FORMAT.test(normalised)) {
      setFailure({
        scope: "number",
        message: "El número va con el prefijo del país y sin espacios: 34600111222.",
      });
      return;
    }

    setFailure(null);
    setBusy(true);

    try {
      const response = await fetch("/api/verification/start", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ phone: normalised }),
      });

      if (!response.ok) {
        // 503 is missing configuration, and retrying does not fix that, so the
        // text does not ask for it.
        setFailure({
          scope: "service",
          message: response.status === 503 ? NOT_CONFIGURED : DID_NOT_START,
        });
        setBusy(false);
        return;
      }

      const { requestId, checkUrl } = (await response.json()) as {
        requestId: string;
        checkUrl: string | null;
      };

      // Remembered always, including before the jump: that is exactly when this
      // page is about to disappear.
      rememberAttemptInBrowser(requestId);

      if (checkUrl) {
        // From here the carrier is in charge. This line does not return.
        window.location.href = checkUrl;
        return;
      }

      setPhase({ step: "code", requestId });
      setBusy(false);
    } catch {
      setFailure({ scope: "service", message: NO_CONNECTION });
      setBusy(false);
    }
  }

  async function sendCode(requestId: string) {
    const clean = code.replace(/\s/g, "");

    if (clean.length === 0) {
      setFailure({ scope: "code", message: "Escribe el código que te ha llegado." });
      return;
    }

    setFailure(null);
    setBusy(true);

    try {
      const response = await fetch("/api/verification/check", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ requestId, code: clean, channel: "sms" }),
      });

      if (!response.ok) {
        setFailure({ scope: "code", message: BAD_CODE });
        setBusy(false);
        return;
      }

      const data = (await response.json()) as {
        status: string;
        phoneTail?: string;
        person?: { name: string } | null;
      };

      if (data.status !== "completed" || !data.phoneTail) {
        setFailure({ scope: "code", message: BAD_CODE });
        setBusy(false);
        return;
      }

      forgetAttemptInBrowser();

      setPhase({
        step: "inside",
        name: data.person?.name ?? null,
        tail: data.phoneTail,
      });
      setBusy(false);

      // The home page is a server component: without refreshing it would keep
      // showing the form even though the session is open.
      if (data.person) router.refresh();
    } catch {
      setFailure({ scope: "service", message: NO_CONNECTION });
      setBusy(false);
    }
  }

  if (phase.step === "inside") {
    return (
      <div aria-live="polite">
        {phase.name ? (
          <Notice title={`Hola, ${phase.name}`}>
            <p>Ya estás dentro. No hace falta que vuelvas a entrar.</p>
          </Notice>
        ) : (
          <Notice tone="alert" title="Línea confirmada">
            <p>
              El teléfono acabado en {phase.tail} es tuyo, pero no está en esta
              casa. Que te añada alguien de la familia y vuelve a entrar.
            </p>
          </Notice>
        )}
      </div>
    );
  }

  // The phase wins over what is stored: on success `phase` already says
  // "inside" even though the store takes a render to empty.
  const attemptInFlight = phase.step === "code" ? phase.requestId : pending;

  if (attemptInFlight) {
    const requestId = attemptInFlight;

    return (
      <div className="flex flex-col gap-5">
        <Notice title="Te he mandado un código">
          <p>
            Tu operador no ha podido confirmar la línea por su cuenta, así que va
            por SMS. Escribe el código que acabas de recibir.
          </p>
        </Notice>

        <form
          className="flex flex-col gap-4"
          onSubmit={(event) => {
            event.preventDefault();
            void sendCode(requestId);
          }}
        >
          <Field
            label="Código del SMS"
            hint="Los dígitos que te acaban de llegar"
            error={failure?.scope === "code" ? failure.message : undefined}
            type="text"
            inputMode="numeric"
            autoComplete="one-time-code"
            name="code"
            required
            value={code}
            disabled={busy}
            onChange={(event) => setCode(event.target.value)}
          />

          <Button type="submit" loading={busy}>
            {busy ? "Comprobando" : "Confirmar"}
          </Button>
        </form>

        <Button variant="secondary" disabled={busy} onClick={startWithAnotherNumber}>
          Usar otro número
        </Button>

        {failure?.scope === "service" ? (
          <Notice tone="alert">
            <p>{failure.message}</p>
          </Notice>
        ) : null}
      </div>
    );
  }

  if (phase.step === "door") {
    return (
      <div className="flex flex-col gap-3">
        <Button
          icon={<Smartphone className="size-5" aria-hidden="true" />}
          onClick={() => setPhase({ step: "phone" })}
        >
          Entrar con mi teléfono
        </Button>

        <p className="text-center text-sm text-ink-muted">
          Lo confirma tu operador. No hay que escribir ningún código.
        </p>

        {alternative}
      </div>
    );
  }

  return (
    <div className="flex flex-col gap-5">
      <Notice tone="alert" title="Apaga el wifi antes de empezar">
        <p>
          La comprobación va por la red de tu operador. Con el wifi encendido no
          sale por ahí y hay que teclear un código.
        </p>
      </Notice>

      <form
        className="flex flex-col gap-4"
        onSubmit={(event) => {
          event.preventDefault();
          void askForVerification();
        }}
      >
        <Field
          label="Tu teléfono"
          hint="Con el prefijo del país y sin espacios: 34600111222"
          error={failure?.scope === "number" ? failure.message : undefined}
          type="tel"
          inputMode="tel"
          autoComplete="tel"
          name="phone"
          required
          value={phone}
          disabled={busy}
          onChange={(event) => setPhone(event.target.value)}
        />

        {/* Only type="submit", no onClick: with both, one press asked for two
            verifications. Submit also answers Enter inside the field. */}
        <Button type="submit" loading={busy}>
          {busy ? "Comprobando" : "Verificar"}
        </Button>
      </form>

      {/* Outside the form: this describes the application, not the number. */}
      {failure?.scope === "service" ? (
        <Notice tone="alert">
          <p>{failure.message}</p>
        </Notice>
      ) : null}

      {/* Without this, someone on a screen reader never learns the button did
          anything: the state change is visual and nothing else. */}
      <p aria-live="polite" className="sr-only">
        {busy ? "Comprobando tu línea." : ""}
      </p>
    </div>
  );
}

// Placeholder page. It exists so the skeleton is deployable before the
// product is: the public URL and its webhooks first, then what goes inside.
// The day's timeline replaces it once that exists.

export default function Home() {
  return (
    <main className="mx-auto flex min-h-dvh max-w-2xl flex-col justify-center gap-4 px-6 py-16">
      {/* accent-strong and not accent: the teal fill is 1.38:1 and unreadable
          as text. The pair exists for exactly this. */}
      <h1 className="font-display text-4xl font-semibold tracking-tight text-accent-strong">
        OFFLOAD
      </h1>

      <p className="text-lg text-balance">
        Una aplicación familiar que reparte la carga mental.
      </p>

      <p className="text-ink-muted">
        Mia encuentra los problemas antes de que nadie los vea, resuelve sola lo
        que no cambia el plan de nadie, y solo pide un sí o un no cuando hace
        falta.
      </p>
    </main>
  );
}

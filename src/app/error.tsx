"use client";

import { Button } from "@/components/ui/button";

/**
 * Next.js's own boundary for anything a server component throws while
 * rendering — `currentPerson()` losing its database connection, mainly.
 * Without this, that kind of failure shows Next's default error page
 * instead of one that fits the product. Covers every route under `app/`
 * that doesn't define its own, `/offload` included.
 */
export default function Error({ reset }: { error: Error & { digest?: string }; reset: () => void }) {
  return (
    <main className="mx-auto flex min-h-dvh w-full max-w-md flex-col items-center justify-center gap-4 bg-bg px-6 text-center">
      <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>
      <h1 className="font-display text-2xl font-semibold text-ink">Algo ha fallado.</h1>
      <p className="text-ink-muted">No he podido cargar esto. Vuelve a intentarlo.</p>
      <Button onClick={reset}>Reintentar</Button>
    </main>
  );
}

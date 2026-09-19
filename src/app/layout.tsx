import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OFFLOAD",
  description:
    "Una aplicación familiar que reparte la carga mental. Mia encuentra los " +
    "problemas antes de que nadie los vea y solo pide un sí o un no cuando hace falta.",
};

// `lang="es"` no es decorativo: sin él, un lector de pantalla pronuncia el
// castellano con fonética inglesa y la página deja de entenderse.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {/* First tabbable element in the whole app. Invisible until it
            receives focus; then it jumps in front of any screen (light or
            dark) with its own opaque box, so it doesn't depend on what
            background is behind it. Each screen marks its main content
            with `id="contenido"`. */}
        <a
          href="#contenido"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-[var(--color-fondo)] focus:px-4 focus:py-2 focus:font-medium focus:text-[var(--color-texto)]"
        >
          Saltar al contenido principal
        </a>

        {children}
      </body>
    </html>
  );
}

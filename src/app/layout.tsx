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
      <body className="antialiased">{children}</body>
    </html>
  );
}

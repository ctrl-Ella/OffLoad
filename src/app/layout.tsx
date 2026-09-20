import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offload · Menos carga mental, más tiempo para vivir",
  description:
    "Coordina los planes familiares, resuelve imprevistos y recupera tiempo para ti con Offload y Mia.",
};

// `lang="es"` no es decorativo: sin él, un lector de pantalla pronuncia el
// castellano con fonética inglesa y la página deja de entenderse.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="es">
      <body className="antialiased">
        {/* Lives in the layout, so it has to point at the id every screen uses. */}
        <a className="skip-link" href="#content">
          Saltar al contenido principal
        </a>
        {children}
      </body>
    </html>
  );
}

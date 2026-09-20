import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offload · Less mental load, more time to live",
  description:
    "Coordinate the family's plans, resolve what comes up and get time back for yourself with Offload and Mia.",
};

// The screens are English by team decision; only what Mia says out loud is
// Spanish, and that is audio, not this document.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">
        {/* Lives in the layout, so it has to point at the id every screen uses. */}
        <a className="skip-link" href="#content">
          Skip to main content
        </a>
        {children}
      </body>
    </html>
  );
}

import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "Offload · Less mental load, more time to live",
  description:
    "Coordinate family plans, handle the unexpected, and make more time for yourself with Offload and Mia.",
};

export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased"><a className="skip-link" href="#content">Skip to main content</a>{children}</body>
    </html>
  );
}

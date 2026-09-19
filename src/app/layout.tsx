import type { Metadata } from "next";
import "./globals.css";

export const metadata: Metadata = {
  title: "OFFLOAD",
  description:
    "A family app that shares the mental load. Mia spots problems before " +
    "anyone else does and only asks for a yes or no when needed.",
};

// Declare the interface language so screen readers use English pronunciation.
export default function RootLayout({
  children,
}: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="en">
      <body className="antialiased">{children}</body>
    </html>
  );
}

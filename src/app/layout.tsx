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
      <body className="antialiased">
        {/* First tabbable element in the whole app. Invisible until it
            receives focus; then it jumps in front of any screen (light or
            dark) with its own opaque box, so it doesn't depend on what
            background is behind it. Each screen marks its main content
            with `id="content"`. */}
        <a
          href="#content"
          className="sr-only focus:not-sr-only focus:fixed focus:top-4 focus:left-4 focus:z-50 focus:rounded-md focus:bg-bg focus:px-4 focus:py-2 focus:font-medium focus:text-ink"
        >
          Skip to main content
        </a>

        {children}
      </body>
    </html>
  );
}

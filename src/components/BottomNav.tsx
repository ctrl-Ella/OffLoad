"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Circle, Clock, Home, Mic2 } from "lucide-react";
import type { ComponentType } from "react";

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

type BottomNavVariant = "immersive" | "light";

// Week and Plan are gone: neither is a screen of its own, and Week's slot
// now points back to the presentation page instead. Only the light variant
// (the recovered-time summary) still uses this full list — the immersive
// one, below, is down to a single mark.
const TABS: Tab[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/offload", label: "Offload", Icon: Circle },
  { href: "/tiempo", label: "Time", Icon: Clock },
];

/**
 * The light variant is the four-section menu, always visible, for the
 * recovered-time summary. The immersive variant — the voice flow's own —
 * is down to two marks instead, Home and Offload, the same icons
 * `AppNavigation`'s mobile bar uses for them, shown only on mobile to
 * match that same bar's own breakpoint. `Time` is dropped: this flow has
 * no reason to send anyone there.
 */
export function BottomNav({ variant = "immersive" }: { variant?: BottomNavVariant }) {
  const pathname = usePathname();

  if (variant === "immersive") {
    return (
      <nav aria-label="OFFLOAD" className="flex justify-center gap-6 sm:hidden">
        <Link
          href="/"
          aria-label="Home"
          className="flex h-11 w-11 items-center justify-center rounded-control text-ink-muted-immersive"
        >
          <Home className="h-6 w-6" aria-hidden="true" />
        </Link>

        <Link
          href="/offload"
          aria-current={pathname === "/offload" ? "page" : undefined}
          aria-label="Offload"
          className="flex h-11 w-11 items-center justify-center rounded-control text-accent-immersive"
        >
          <Mic2 className="h-6 w-6" aria-hidden="true" />
        </Link>
      </nav>
    );
  }

  return (
    <nav aria-label="OFFLOAD sections" className="w-full">
      <ul className="flex items-stretch justify-between">
        {TABS.map(({ href, label, Icon }) => {
          const isActive = pathname === href;

          return (
            <li key={href} className="flex-1">
              <Link
                href={href}
                aria-current={isActive ? "page" : undefined}
                className={`flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-medium ${
                  isActive ? "text-accent-strong" : "text-ink-muted"
                }`}
              >
                <Icon className="h-6 w-6" aria-hidden="true" />
                {label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}

"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { Circle, Clock, Home } from "lucide-react";
import type { ComponentType } from "react";

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

// Week and Plan are gone: neither is a screen of its own, and Week's slot
// now points back to the presentation page instead. Time doesn't exist yet
// either, out of scope for this task — its link is ready for when that
// screen gets built; until then, navigating to it lands on a route Next.js
// resolves as 404, which beats a button that does nothing.
const TABS: Tab[] = [
  { href: "/", label: "Home", Icon: Home },
  { href: "/offload", label: "Offload", Icon: Circle },
  { href: "/tiempo", label: "Time", Icon: Clock },
];

/**
 * The four-section menu, always visible at the bottom of the screen.
 *
 * Coloured for the listening screen's immersive palette, the only one that
 * exists today. Once the day's journey, the proposal card and the recovered
 * time are built on the light background, this bar needs a light variant —
 * not guessed here without seeing it side by side.
 */
export function BottomNav() {
  const pathname = usePathname();

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
                  isActive ? "text-accent-immersive" : "text-ink-muted-immersive"
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

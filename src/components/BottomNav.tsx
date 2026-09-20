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

type BottomNavVariant = "immersive" | "light";

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
 * It has an immersive variant for the voice flow and a light variant for the
 * recovered-time summary. Both keep the same route map and active state.
 */
export function BottomNav({ variant = "immersive" }: { variant?: BottomNavVariant }) {
  const pathname = usePathname();
  const activeClass = variant === "light" ? "text-accent-strong" : "text-accent-immersive";
  const inactiveClass = variant === "light" ? "text-ink-muted" : "text-ink-muted-immersive";

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
                  isActive ? activeClass : inactiveClass
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

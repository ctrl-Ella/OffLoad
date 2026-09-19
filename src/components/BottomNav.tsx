"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { CalendarDays, CalendarRange, Circle, Clock } from "lucide-react";
import type { ComponentType } from "react";

type Tab = {
  href: string;
  label: string;
  Icon: ComponentType<{ className?: string }>;
};

// Week, Plan and Time don't exist as screens yet: they're the rest of
// the mockup's tabs, out of scope for this task. Their links are ready for
// when those screens get built; until then, navigating to them lands on a
// route Next.js resolves as 404, which beats a button that does nothing.
const TABS: Tab[] = [
  { href: "/semana", label: "Week", Icon: CalendarRange },
  { href: "/offload", label: "Offload", Icon: Circle },
  { href: "/plan", label: "Plan", Icon: CalendarDays },
  { href: "/tiempo", label: "Time", Icon: Clock },
];

/**
 * The four-section menu, always visible at the bottom of the screen.
 *
 * Colored for the listening screen's immersive palette, the only one that
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
                className="flex flex-col items-center gap-1 rounded-lg px-2 py-3 text-xs font-medium"
                style={{
                  color: isActive
                    ? "var(--color-turquesa-inmersivo)"
                    : "var(--color-texto-suave-inmersivo)",
                }}
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

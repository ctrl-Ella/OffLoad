"use client";

import Image from "next/image";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SignedInPerson } from "@/lib/session";

/**
 * The logo on the left, the account menu on the right — shared by every
 * state of the voice flow (see `ListeningScreen`, `ReviewPlan`) instead of
 * duplicated in each. There's no back arrow here: `BottomNav` is this flow's
 * way out, and the account menu takes the header's other corner.
 *
 * The popover is a light card on purpose, not built from the immersive
 * tokens: it's the same account menu the signed-in presentation screen
 * uses, reusing `Button`'s `secondary` variant unchanged rather than
 * measuring a second, dark version of the same content.
 */
export function OffloadHeader({ person }: { person: SignedInPerson | null }) {
  return (
    <header className="flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))]">
      <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink-immersive">
        <Image src="/mia-still.png" alt="" width={28} height={31} />
        offload<span className="text-accent-immersive">.</span>
      </span>

      {person ? (
        <details className="relative">
          <summary
            aria-label="Your profile"
            className="flex h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-control bg-accent text-ink hover:brightness-95 [&::-webkit-details-marker]:hidden"
          >
            <User className="h-5 w-5" aria-hidden="true" />
          </summary>

          <div className="absolute right-0 z-10 mt-2 w-72 rounded-card border border-border bg-white p-4 text-left shadow-sm">
            <p className="text-sm font-medium text-ink">{person.name}</p>
            <p className="mt-1 text-sm text-ink-muted">
              Line ending in {person.phoneTail}, confirmed by your carrier. I remember
              you for thirty days.
            </p>
            <form action="/api/auth/logout" method="post" className="mt-3">
              <Button type="submit" variant="secondary" size="small">
                Sign out
              </Button>
            </form>
          </div>
        </details>
      ) : null}
    </header>
  );
}

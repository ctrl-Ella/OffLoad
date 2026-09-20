"use client";

import { useEffect, useRef, useState } from "react";
import { User } from "lucide-react";
import { Button } from "@/components/ui/button";
import type { SignedInPerson } from "@/lib/session";

/**
 * Who is signed in, and the way out. One component and not one per header:
 * the confirmation below has to be in a single place, or the header nobody
 * edits keeps the version that signs you out on the first press.
 *
 * Signing out is behind a confirmation because it was being used as "I'm
 * leaving". Leaving costs nothing — closing the tab keeps you signed in for
 * thirty days — but this button deletes the session row, and the next visit
 * asks for the phone number again. So the one control that ends something
 * says what it ends before it does it.
 */

/** The two surfaces this menu opens on, each with its own measured trigger. */
const TRIGGER = {
  light: "text-ink-muted hover:bg-white",
  immersive: "bg-accent text-ink hover:brightness-95",
} as const;

export function AccountMenu({
  person,
  tone,
}: Readonly<{ person: SignedInPerson; tone: keyof typeof TRIGGER }>) {
  const [confirming, setConfirming] = useState(false);
  const toConfirm = useRef<HTMLButtonElement | null>(null);

  // The confirmation replaces the button that was focused, so focus would fall
  // to the top of the page in the middle of a decision.
  useEffect(() => {
    if (confirming) toConfirm.current?.focus();
  }, [confirming]);

  return (
    // Closing and reopening starts from the top: nobody should find the
    // confirmation already waiting for them.
    <details className="relative" onToggle={() => setConfirming(false)}>
      <summary
        aria-label="Your profile"
        className={`inline-flex h-11 min-w-11 cursor-pointer list-none items-center justify-center rounded-control [&::-webkit-details-marker]:hidden ${TRIGGER[tone]}`}
      >
        <User className="size-5" aria-hidden="true" />
      </summary>

      <div className="absolute right-0 z-10 mt-2 w-72 rounded-card border border-border bg-white p-4 text-left shadow-sm">
        <p className="text-sm font-medium text-ink">{person.name}</p>
        <p className="mt-1 text-sm text-ink-muted">
          Line ending in {person.phoneTail}, confirmed by your carrier. I remember you
          for thirty days.
        </p>

        {confirming ? (
          <>
            <p className="mt-3 text-sm text-ink">
              Signing out means confirming your number again next time.
            </p>

            <div className="mt-3 flex flex-wrap gap-2">
              <form action="/api/auth/logout" method="post">
                <Button type="submit" variant="danger" size="small" ref={toConfirm}>
                  Sign out
                </Button>
              </form>

              <Button variant="secondary" size="small" onClick={() => setConfirming(false)}>
                Stay signed in
              </Button>
            </div>
          </>
        ) : (
          <Button
            variant="secondary"
            size="small"
            className="mt-3"
            onClick={() => setConfirming(true)}
          >
            Sign out
          </Button>
        )}
      </div>
    </details>
  );
}

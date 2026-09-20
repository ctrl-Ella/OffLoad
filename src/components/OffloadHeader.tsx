"use client";

import Image from "next/image";
import { AccountMenu } from "@/components/account-menu";
import type { SignedInPerson } from "@/lib/session";

/**
 * The logo on the left, the account menu on the right — shared by every
 * state of the voice flow (see `ListeningScreen`, `ReviewPlan`) instead of
 * duplicated in each. There's no back arrow here: `BottomNav` is this flow's
 * way out, and the account menu takes the header's other corner.
 *
 * The menu itself is `AccountMenu`, the same one the presentation screen
 * shows. Its popover is a light card on purpose, not built from the immersive
 * tokens: it's the same content, and a second dark version of one dropdown is
 * exactly the kind of second stylesheet this project's conventions warn about.
 */
export function OffloadHeader({ person }: { person: SignedInPerson | null }) {
  return (
    <header className="flex items-center justify-between pt-[max(1rem,env(safe-area-inset-top))]">
      <span className="flex items-center gap-2 font-display text-lg font-extrabold tracking-tight text-ink-immersive">
        <Image src="/mia-still.png" alt="" width={28} height={31} />
        offload<span className="text-accent-immersive">.</span>
      </span>

      {person ? <AccountMenu person={person} tone="immersive" /> : null}
    </header>
  );
}

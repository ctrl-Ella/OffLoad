"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { Video } from "lucide-react";

/**
 * "There is a call open". What the person who did not open it sees.
 *
 * It exists because Mia does not call on her own. One person opens the room
 * and the other decides whether to enter: without this notice that decision
 * never gets taken, because there is no way to find out. It appears and
 * disappears by itself: when the other person hangs up there are no streams
 * left and the notice goes, so no "you are being called" from half an hour
 * ago stays on the screen.
 */

/**
 * Five seconds and not one: under every turn there is a request to Vonage,
 * and both people in the house poll this while the home screen is open. The
 * delay that shows is the one of finding out, and five seconds is what it
 * takes someone to look at the screen.
 */
const EVERY_MS = 5000;

export function CallNotice() {
  const [who, setWho] = useState<string | null>(null);

  useEffect(() => {
    let alive = true;

    const look = async () => {
      try {
        const response = await fetch("/api/room/status");

        if (!response.ok) return;

        const { inCall, who: openedBy } = (await response.json()) as {
          inCall: boolean;
          who: string | null;
        };

        // The component may have gone while the request was coming back.
        if (alive) setWho(inCall ? (openedBy ?? "Someone at home") : null);
      } catch {
        // Looked at again in five seconds. A network stumble is not news to give anyone.
      }
    };

    const first = setTimeout(() => void look(), 0);
    const clock = setInterval(() => void look(), EVERY_MS);

    return () => {
      alive = false;
      clearTimeout(first);
      clearInterval(clock);
    };
  }, []);

  return (
    // The region lives always, even empty: one that appears with its content
    // inside is not announced, because the reader was not watching it.
    <div aria-live="polite">{who && <CallBanner who={who} />}</div>
  );
}

/** The notice itself, with nothing to poll: what `/system` shows. */
export function CallBanner({ who }: Readonly<{ who: string }>) {
  return (
    <div className="flex flex-wrap items-center gap-3 rounded-card bg-alert p-4 text-ink">
      <span
        aria-hidden="true"
        className="flex size-9 shrink-0 items-center justify-center rounded-full bg-ink text-alert"
      >
        <Video className="size-4" />
      </span>

      <p className="min-w-0 flex-1">{who} has opened a call.</p>

      {/* A link and not a `Button`: it leads to another screen. It wears the
          secondary's clothes on the coral fill, onyx on onyx edge. */}
      <Link
        href="/call"
        className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control border border-ink px-4 text-[15px] font-medium text-ink hover:bg-white/40"
      >
        Join
      </Link>
    </div>
  );
}

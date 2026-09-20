import type { Metadata } from "next";
import { GuestRoom } from "@/components/GuestRoom";

/**
 * Where Mia's SMS link lands. No sign-in, no navigation chrome: whoever
 * opens this has never been in the app before, and the token in the URL is
 * the only credential there is. Validating it is `GuestRoom`'s and its
 * route's job, not this page's — a bad or expired link is a failure state
 * `useRoom` already knows how to show, once "Join the call" is pressed.
 */

export const metadata: Metadata = {
  title: "Join the call | OFFLOAD",
  description: "A one-time link into a family's video call.",
};

export default async function JoinPage({ params }: { params: Promise<{ token: string }> }) {
  const { token } = await params;

  return (
    <div className="presentation-page">
      <main id="content" className="presentation-shell pt-10 pb-20">
        <p className="presentation-eyebrow">
          <span aria-hidden="true" />
          ON VIDEO
        </p>
        <h1 className="mt-3 text-[clamp(28px,3.5vw,42px)] leading-[1.05] tracking-[-.045em] text-ink">
          You&apos;ve been invited to a call
        </h1>
        <p className="mt-3 text-[15px] text-ink-muted">Join when you&apos;re ready.</p>

        <GuestRoom token={token} />
      </main>
    </div>
  );
}

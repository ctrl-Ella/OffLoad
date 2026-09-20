import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TriangleAlert, Users, Video } from "lucide-react";
import { ConflictBreakdown } from "@/components/ConflictBreakdown";
import { MiaFigure } from "@/components/mia";
import { todayInMadrid } from "@/lib/clock";
import { otherCorePerson } from "@/lib/household";
import { coreJourney } from "@/lib/schedule";
import { currentPerson } from "@/lib/session";

/**
 * The clash, full screen. A clash is the one thing in this product that
 * forces a decision, and deciding on half a screen with the rest of the house
 * around it is the opposite of removing mental load.
 *
 * Mia does not resolve here, she shows. What happens with the clash is chosen
 * by whoever reads it: that is the rule that decides almost everything — does
 * this change anyone's plans? — and a clash that needs another person always
 * does.
 */

export const metadata: Metadata = {
  title: "A clash in your day | OFFLOAD",
  description: "What doesn't fit today, and what can be done about it.",
};

export default async function ConflictPage() {
  const person = await currentPerson();

  if (!person) redirect("/");

  // The clash belongs to the day, not to a run: hung off a run, this page
  // stopped existing the moment the home screen reloaded, with the problem
  // still there. And what is read is the day of whoever is looking.
  const [lane] = await coreJourney(todayInMadrid(), person.id);
  const clash = lane?.conflicts[0];

  if (!clash) notFound();

  const others = (lane?.conflicts.length ?? 1) - 1;

  // Looked up, not written: both core people see this screen, and each has
  // the other in front of them.
  const other = await otherCorePerson(person.id);

  return (
    <main
      id="content"
      className="mx-auto flex w-full max-w-md flex-1 flex-col px-6 pt-11 pb-7 lg:max-w-2xl lg:px-10 lg:pt-12 lg:pb-12"
    >
      <div className="flex items-center justify-between">
        <p className="font-display text-xl font-bold tracking-tight text-ink">OFFLOAD</p>

        <Link
          href="/"
          className="inline-flex size-11 items-center justify-center rounded-control text-ink-muted hover:bg-white hover:text-ink"
          aria-label="Back"
        >
          <ArrowLeft className="size-5" aria-hidden="true" />
        </Link>
      </div>

      <div className="mt-8 flex items-start gap-4">
        <span
          aria-hidden="true"
          className="flex size-11 shrink-0 items-center justify-center rounded-full bg-alert text-ink"
        >
          <TriangleAlert className="size-6" />
        </span>

        <div className="min-w-0">
          <p className="font-mono text-xs tracking-wide text-alert-strong uppercase">
            Clash detected
          </p>
          <h1 className="mt-1 font-display text-[clamp(1.75rem,1.3rem+1.8vw,2.5rem)] leading-tight text-ink">
            You won&apos;t make it to &ldquo;{clash.next.title}&rdquo;
          </h1>

          {/* The first is shown, but hiding the rest would be half the truth:
              with three clashes, whoever reads has to know before deciding
              anything about one. */}
          {others > 0 && (
            <p className="mt-2 text-sm text-ink-muted">
              And {others === 1 ? "one more clash" : `${others} more clashes`} today.
            </p>
          )}
        </div>
      </div>

      <div className="mt-6">
        <ConflictBreakdown conflict={clash} />
      </div>

      <section aria-labelledby="what-now" className="mt-8">
        <h2 id="what-now" className="font-mono text-xs tracking-wide text-ink-muted uppercase">
          What do we do?
        </h2>

        <div className="mt-3 grid gap-3">
          {/* The call is asked for, never opened on its own. It interrupts
              several people at once, so it is what changes everyone's plans
              the most: the decision belongs to whoever reads this. */}
          <div className="rounded-card border border-border bg-white p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-alert text-ink"
              >
                <Video className="size-4" />
              </span>

              <div className="min-w-0 flex-1">
                <p className="text-ink">
                  {other ? `Talk it through with ${other} on video` : "Talk it through on video"}
                </p>
                <p className="mt-1 text-sm text-ink-muted">
                  The two of you decide. I listen along.
                </p>

                {/* A link and not a `Button`: this leads to another screen,
                    and a button inside a link is invalid HTML. It wears the
                    primary's classes because it is the same visual promise. */}
                <div className="mt-3">
                  <Link
                    href="/call"
                    className="inline-flex min-h-11 items-center justify-center gap-2 rounded-control bg-accent px-4 text-[15px] font-medium text-ink transition-[filter] duration-150 hover:brightness-95"
                  >
                    <Video className="size-[18px]" aria-hidden="true" />
                    Open the call
                  </Link>
                </div>
              </div>
            </div>
          </div>

          {/* What Mia knows today and cannot claim: of the support network
              she does not say whether they are free, because she does not see
              their calendars. Saying so is rule 3, and staying silent would
              pretend they do not exist. */}
          <div className="rounded-card border border-border bg-white p-4">
            <div className="flex items-start gap-3">
              <span
                aria-hidden="true"
                className="flex size-9 shrink-0 items-center justify-center rounded-full bg-border text-ink-muted"
              >
                <Users className="size-4" />
              </span>

              <div className="min-w-0">
                <p className="text-ink">Ask your support network</p>
                <p className="mt-1 text-sm text-ink-muted">
                  I can&apos;t see their calendars, so I don&apos;t know if they&apos;re free. The
                  only way to know is to ask them.
                </p>
              </div>
            </div>
          </div>
        </div>
      </section>

      <div className="mt-10 flex items-center gap-3">
        {/* Quiet, because nothing is running: she found the clash and stopped. */}
        <MiaFigure state="quiet" className="h-auto w-12 shrink-0" />
        <p className="text-sm text-ink-muted">
          I haven&apos;t changed anything in your day. This one is yours to decide.
        </p>
      </div>
    </main>
  );
}

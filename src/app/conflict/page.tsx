import type { Metadata } from "next";
import Link from "next/link";
import { notFound, redirect } from "next/navigation";
import { ArrowLeft, TriangleAlert, Users, Video } from "lucide-react";
import { AppNavigation } from "@/components/app-navigation";
import { ConflictBreakdown } from "@/components/ConflictBreakdown";
import { MiaFigure } from "@/components/mia";
import { todayInMadrid, ZONE } from "@/lib/clock";
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

/**
 * `?day=YYYY-MM-DD`, or today when it is missing or malformed.
 *
 * Falling back rather than refusing: this parameter arrives from a link
 * somebody followed, and a day that does not parse is a broken link, not an
 * attack. Whether there is a clash on the day it lands on is answered below,
 * the same way it always was.
 */
function dayAsked(raw: string | string[] | undefined): string {
  if (typeof raw !== "string" || !/^\d{4}-\d{2}-\d{2}$/.test(raw)) return todayInMadrid();

  return Number.isNaN(new Date(`${raw}T12:00:00Z`).getTime()) ? todayInMadrid() : raw;
}

const LONG_DAY = new Intl.DateTimeFormat("en-GB", {
  timeZone: ZONE,
  weekday: "long",
  day: "numeric",
  month: "long",
});

/**
 * «today», or the day named, for the line that counts the other clashes.
 * Saying "today" over a Sunday's clash is the kind of small lie that makes
 * someone stop trusting the rest of the screen.
 */
function whenToCallIt(day: string): string {
  if (day === todayInMadrid()) return "today";

  return `on ${LONG_DAY.format(new Date(`${day}T12:00:00Z`))}`;
}

export default async function ConflictPage({
  searchParams,
}: Readonly<{
  searchParams: Promise<{ [key: string]: string | string[] | undefined }>;
}>) {
  const person = await currentPerson();

  if (!person) redirect("/");

  const day = dayAsked((await searchParams).day);

  // The clash belongs to the day, not to a run: hung off a run, this page
  // stopped existing the moment the home screen reloaded, with the problem
  // still there. And what is read is the day of whoever is looking.
  const [lane] = await coreJourney(day, person.id);
  const clash = lane?.conflicts[0];

  if (!clash) notFound();

  const others = (lane?.conflicts.length ?? 1) - 1;

  const when = whenToCallIt(day);

  // Looked up, not written: both core people see this screen, and each has
  // the other in front of them.
  const other = await otherCorePerson(person.id);

  return (
    <div className="presentation-page">
      <AppNavigation person={person} />

      <main id="content" className="presentation-shell pt-6 pb-20">
        <Link href="/" className="presentation-back">
          <ArrowLeft className="size-4" aria-hidden="true" />
          Back to your day
        </Link>

        <div className="mt-6 flex items-start gap-4">
          <span
            aria-hidden="true"
            className="flex size-11 shrink-0 items-center justify-center rounded-full bg-alert text-ink"
          >
            <TriangleAlert className="size-6" />
          </span>

          <div className="min-w-0">
            <p className="presentation-eyebrow presentation-eyebrow-alert">
              <span aria-hidden="true" />
              CLASH DETECTED
            </p>
            <h1 className="mt-3 text-[clamp(34px,3.5vw,50px)] leading-[1.05] tracking-[-.045em] text-ink">
              You won&apos;t make it to &ldquo;{clash.next.title}&rdquo;
            </h1>

            {/* The first is shown, but hiding the rest would be half the truth:
                with three clashes, whoever reads has to know before deciding
                anything about one. */}
            {others > 0 && (
              <p className="mt-3 text-[15px] text-ink-muted">
                And {others === 1 ? "one more clash" : `${others} more clashes`} {when}.
              </p>
            )}
          </div>
        </div>

        <div className="mt-8">
          <ConflictBreakdown conflict={clash} />
        </div>

        <section aria-labelledby="what-now" className="mt-10">
          <h2 id="what-now" className="presentation-section-label">
            WHAT DO WE DO?
          </h2>

          <div className="mt-4 grid gap-4 lg:grid-cols-2">
            {/* The call is asked for, never opened on its own. It interrupts
                several people at once, so it is what changes everyone's plans
                the most: the decision belongs to whoever reads this. */}
            <div className="presentation-panel">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-alert text-ink"
                >
                  <Video className="size-5" />
                </span>

                <div className="min-w-0 flex-1">
                  <p className="font-display text-[19px] font-extrabold text-ink">
                    {other ? `Talk it through with ${other}` : "Talk it through on video"}
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    The two of you decide. I listen along.
                  </p>

                  {/* A link and not a `Button`: this leads to another screen,
                      and a button inside a link is invalid HTML. */}
                  <div className="presentation-actions">
                    <Link href="/call" className="presentation-button presentation-button-primary">
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
            <div className="presentation-panel">
              <div className="flex items-start gap-3">
                <span
                  aria-hidden="true"
                  className="flex size-11 shrink-0 items-center justify-center rounded-[13px] bg-bg text-ink-muted"
                >
                  <Users className="size-5" />
                </span>

                <div className="min-w-0">
                  <p className="font-display text-[19px] font-extrabold text-ink">
                    Ask your support network
                  </p>
                  <p className="mt-2 text-sm text-ink-muted">
                    I can&apos;t see their calendars, so I don&apos;t know if they&apos;re free.
                    The only way to know is to ask them.
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
    </div>
  );
}

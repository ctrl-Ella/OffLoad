"use client";

import { ArrowRight, CalendarDays, CalendarPlus, Check, SquareCheck, TriangleAlert } from "lucide-react";
import Link from "next/link";
import { useCallback, useState, type ComponentType } from "react";
import { BottomNav } from "@/components/BottomNav";
import { ListeningOrb } from "@/components/ListeningOrb";
import { OffloadHeader } from "@/components/OffloadHeader";
import { Button } from "@/components/ui/button";
import { fetchWithTimeout, isTimeout } from "@/lib/fetch-with-timeout";
import type { SignedInPerson } from "@/lib/session";

/**
 * One row of the structured plan `/api/structure-plan` returns. `detail` is
 * already formatted for display — a time range, a deadline, or a conflict's
 * own description — this component doesn't compute or reformat it.
 */
export type PlanItem = {
  title: string;
  detail: string;
  type: "event" | "task" | "conflict";
  /**
   * The saved capture this row can be confirmed onto a calendar, or null when
   * there is nothing to write. A button appears for exactly the rows that have
   * one, so it can never be pressed on something that cannot be written.
   */
  captureId: string | null;
  /** `YYYY-MM-DD` in the household's zone, or null for a row with no time. */
  day: string | null;
};

const ICON: Record<PlanItem["type"], ComponentType<{ className?: string }>> = {
  event: CalendarDays,
  task: SquareCheck,
  conflict: TriangleAlert,
};

// This screen's chrome stays English, same deliberate exception as the rest
// of the voice flow (see ListeningScreen). `title` and `detail` are the
// person's own words, already in Spanish, and are never touched here.
const TYPE_LABEL: Record<PlanItem["type"], string> = {
  event: "Event",
  task: "Task",
  conflict: "Conflict",
};

// An event Mia understood without an hour. It keeps its card and says what is
// missing, rather than being quietly filed as a task or given a button that
// would have to invent a time to work.
const NO_TIME = "No time for this yet, so it can't go on a calendar.";

/**
 * What each way the write can fail says to whoever pressed the button. Each
 * one names what happened and what to do now, which is the shape the rest of
 * this flow's error text uses.
 *
 * The server's own messages are never shown: they are written for a log.
 */
const CANNOT_REACH = "Couldn't reach the calendar. Try again.";
const TAKING_TOO_LONG = "That's taking too long. Try again.";
const NO_CALENDAR = "No calendar connected. Connect Google and try again.";
const RECONNECT_GOOGLE = "Google needs connecting again before this can be written.";

const CONFIRM_TIMEOUT_MS = 20_000;

/** Ready, writing, written. Plus the message when it did not get written. */
type RowState =
  | { state: "writing" }
  | { state: "on-the-calendar" }
  | { state: "failed"; message: string };

function itemCountLabel(count: number): string {
  return count === 1 ? "1 thing, sorted." : `${count} things, sorted.`;
}

/** Whatever came back from a failed attempt, as the one line the card shows. */
function whatWentWrong(error: unknown): string {
  if (isTimeout(error)) return TAKING_TOO_LONG;

  return error instanceof Error ? error.message : CANNOT_REACH;
}

async function confirm(captureId: string): Promise<void> {
  const response = await fetchWithTimeout(
    `/api/captures/${captureId}/confirm`,
    { method: "POST" },
    CONFIRM_TIMEOUT_MS,
  );

  if (response.ok) return;

  // `expired` tells apart the one failure that retrying cannot fix: Google
  // will not renew the permission, and only connecting again will.
  const body: { expired?: boolean } = await response.json().catch(() => ({}));

  if (response.status === 409) {
    throw new Error(body.expired ? RECONNECT_GOOGLE : NO_CALENDAR);
  }

  throw new Error(CANNOT_REACH);
}

/**
 * The voice flow's third and final state: what Mia made of the transcript,
 * one card per event, task or conflict, and the yes that puts an event on a
 * calendar.
 *
 * That yes is the whole of rule 1 on screen. Nothing here writes anything by
 * itself, and no row says it is on the calendar until the server has answered
 * that it is.
 */
export function ReviewPlan({
  items,
  person,
}: Readonly<{
  items: PlanItem[];
  /** Who's signed in, for the header's account menu. `null` renders no menu. */
  person: SignedInPerson | null;
}>) {
  const [rows, setRows] = useState<Record<string, RowState>>({});
  // What was just announced. One region for the whole list rather than one per
  // card: a screen reader should hear the result once, not hunt for it.
  const [announcement, setAnnouncement] = useState("");

  const addToCalendar = useCallback(async (captureId: string, title: string) => {
    setRows((current) => ({ ...current, [captureId]: { state: "writing" } }));
    setAnnouncement("");

    try {
      await confirm(captureId);

      setRows((current) => ({ ...current, [captureId]: { state: "on-the-calendar" } }));
      setAnnouncement(`${title} is on the calendar.`);
    } catch (error) {
      const message = whatWentWrong(error);

      setRows((current) => ({ ...current, [captureId]: { state: "failed", message } }));
      setAnnouncement(`${title} was not added. ${message}`);
    }
  }, []);

  return (
    <div
      data-theme="immersive"
      className="relative flex min-h-dvh flex-col overflow-x-hidden bg-surface-immersive text-ink-immersive"
    >
      {/* Same ambient glow as the other two states of this flow. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute top-0 left-1/2 h-[36rem] w-[36rem] -translate-x-1/2 -translate-y-1/3 rounded-full bg-accent-immersive opacity-20 blur-3xl"
      />

      {/* Its own wrapper, wider than the column below from `lg` up: on
          desktop the logo sits where `AppNavigation`'s header puts it —
          near the true left edge of a wide screen — while the rest of this
          screen stays the same narrow, centred column at every size. */}
      <div className="relative z-10 mx-auto w-full max-w-md px-6 sm:max-w-lg lg:max-w-[1240px] lg:px-8">
        <OffloadHeader person={person} />
      </div>

      <div className="relative z-10 mx-auto flex w-full max-w-md flex-1 flex-col px-6 pb-6 sm:max-w-lg sm:pb-10">
        <main id="content" className="flex flex-1 flex-col gap-6 py-6">
          <div className="flex flex-col items-center gap-4 text-center">
            <ListeningOrb state="success" />

            <div>
              <h1 className="font-display text-2xl font-semibold sm:text-3xl">
                I&apos;ve got it.
              </h1>
              <p className="mt-1 text-pretty text-ink-muted-immersive">
                {itemCountLabel(items.length)}
              </p>
            </div>
          </div>

          {/* Polite, not assertive: this reports what someone just asked for,
              it does not interrupt them mid-sentence. */}
          <p aria-live="polite" className="sr-only">
            {announcement}
          </p>

          <ul className="flex flex-col gap-2.5">
            {items.map((item, index) => {
              const Icon = ICON[item.type];
              const row = item.captureId ? rows[item.captureId] : undefined;
              const failed = row?.state === "failed";
              // A clash and a failed write are both told on the alert surface,
              // which is the one measured against this background.
              const onAlert = item.type === "conflict" || failed;

              return (
                <li
                  key={`${item.title}-${index}`}
                  className={`flex flex-col rounded-card px-4 py-3 ${
                    onAlert ? "bg-alert-surface-immersive" : "bg-card-immersive"
                  }`}
                >
                  <div className="flex min-h-14 items-center gap-3">
                    <span
                      className={`flex h-10 w-10 shrink-0 items-center justify-center rounded-control ${
                        onAlert
                          ? "bg-alert text-surface-immersive"
                          : "bg-chip-immersive text-accent-immersive"
                      }`}
                    >
                      <Icon className="h-5 w-5" aria-hidden="true" />
                    </span>

                    <div className="min-w-0 flex-1">
                      <h2 className="text-pretty break-words text-[15px] font-semibold text-ink-immersive">
                        {item.title}
                      </h2>
                      <p className="mt-0.5 text-pretty break-words text-sm text-ink-muted-immersive">
                        {item.type === "event" && !item.captureId ? NO_TIME : item.detail}
                      </p>
                    </div>

                    <span className="shrink-0 text-xs text-ink-muted-immersive">
                      {TYPE_LABEL[item.type]}
                    </span>
                  </div>

                  {/* A clash has no button, because it is not a thing to write
                      down: it is two things that do not fit, and what to do
                      about it is a decision someone takes on the breakdown
                      screen. A link and not a `Button` — this leads somewhere,
                      and a button inside a link is invalid HTML. */}
                  {item.type === "conflict" && item.day ? (
                    <div className="mt-3 border-t border-border-immersive pt-3">
                      <Link
                        href={`/conflict?day=${item.day}`}
                        className="inline-flex min-h-11 items-center gap-2 rounded-control text-sm font-medium text-ink-immersive underline underline-offset-4 hover:no-underline"
                      >
                        Break this clash down
                        <ArrowRight className="h-4 w-4" aria-hidden="true" />
                        {/* Several clashes produce several links, and a list of
                            identical ones is a list nobody can navigate. The
                            visible text stays whole inside the name, which is
                            what WCAG 2.5.3 asks. */}
                        <span className="sr-only">{`, ${item.title}`}</span>
                      </Link>
                    </div>
                  ) : null}

                  {item.captureId ? (
                    <div className="mt-3 flex items-center justify-between gap-3 border-t border-border-immersive pt-3">
                      {row?.state === "on-the-calendar" ? (
                        <p className="flex items-center gap-2 text-sm font-medium text-accent-immersive">
                          <Check className="h-4 w-4" aria-hidden="true" />
                          On the calendar
                        </p>
                      ) : (
                        <>
                          <p className="min-w-0 flex-1 text-pretty text-sm text-ink-immersive">
                            {failed ? row.message : ""}
                          </p>

                          <Button
                            size="small"
                            loading={row?.state === "writing"}
                            icon={<CalendarPlus className="h-4 w-4" aria-hidden="true" />}
                            // Three rows must not produce three buttons called
                            // the same thing. The visible text is kept whole
                            // inside the name, which is what WCAG 2.5.3 asks.
                            label={`Add to calendar: ${item.title}`}
                            onClick={() => addToCalendar(item.captureId as string, item.title)}
                          >
                            {failed ? "Try again" : "Add to calendar"}
                          </Button>
                        </>
                      )}
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ul>
        </main>

        <footer className="flex flex-col items-center gap-5">
          <hr className="w-full border-t border-border-immersive" />

          <BottomNav />
        </footer>
      </div>
    </div>
  );
}
